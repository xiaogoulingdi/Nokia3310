"""Exercise editable builds and release/dependency verification without network access."""
import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("viewer_build", Path(__file__).resolve().parents[1] / "build.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def sha(data):
    return hashlib.sha256(data).hexdigest()


class BuildWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nokia-build-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.web = self.root / "web"
        self.web.mkdir()
        self.expected = {}
        for name in builder.SOURCE_FILES:
            data = f"original {name}\n".encode()
            (self.web / name).write_bytes(data)
            self.expected[name] = data
        self.model = self.root / builder.MODEL_PATH
        self.model.parent.mkdir(parents=True)
        self.model.write_bytes(b"original model bytes")
        self.expected["assets/nokia3310.glb"] = self.model.read_bytes()
        vendor_data = b"export const fixture = true;"
        member_name = "package/build/three.module.js"
        self.expected["vendor/three/three.module.js"] = vendor_data
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as archive:
            member = tarfile.TarInfo(member_name)
            member.size = len(vendor_data)
            archive.addfile(member, io.BytesIO(vendor_data))
        self.package = buf.getvalue()
        self.tarball = self.root / "three.tgz"
        self.tarball.write_bytes(self.package)
        self.lock = {"schema_version": 2, "three": {
            "version": "0.180.0", "tarball": "https://registry.npmjs.org/three/-/three-0.180.0.tgz",
            "integrity": "sha512-" + base64.b64encode(hashlib.sha512(self.package).digest()).decode(),
            "files": [{"member": member_name, "output": "vendor/three/three.module.js", "sha256": sha(vendor_data)}],
        }}
        self.write_lock()
        self.snapshot = self.root / "release.json"
        self.snapshot.write_text(json.dumps({"files_sha256": {n: sha(d) for n, d in self.expected.items()}}))

    def write_lock(self):
        (self.web / "dependencies.lock.json").write_text(json.dumps(self.lock), encoding="utf-8")

    def test_development_accepts_changed_source_and_alternate_model(self):
        source = b"edited app source"
        (self.web / "app.js").write_bytes(source)
        alternate = self.root / "new-model.glb"
        alternate.write_bytes(b"new model bytes")
        manifest = builder.build(self.web, model=alternate, tarball=self.tarball)
        self.assertEqual((self.web / "dist/app.js").read_bytes(), source)
        self.assertEqual((self.web / "dist/assets/nokia3310.glb").read_bytes(), alternate.read_bytes())
        self.assertEqual(manifest["files"]["app.js"]["sha256"], sha(source))
        self.assertEqual(self.model.read_bytes(), b"original model bytes")

    def test_exact_release_snapshot_preserves_all_runtime_bytes(self):
        manifest = builder.build(self.web, tarball=self.tarball, verify_snapshot=self.snapshot)
        self.assertEqual(manifest["verified_snapshot"], "release.json")
        for name, original in self.expected.items():
            self.assertEqual((self.web / "dist" / name).read_bytes(), original)

    def test_snapshot_mismatch_leaves_previous_output_untouched(self):
        builder.build(self.web, tarball=self.tarball)
        previous = {p.relative_to(self.web / "dist"): p.read_bytes()
                    for p in (self.web / "dist").rglob("*") if p.is_file()}
        for path in (self.web / "app.js", self.model):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                path.write_bytes(original + b"changed")
                with self.assertRaisesRegex(ValueError, "snapshot:"):
                    builder.build(self.web, tarball=self.tarball, verify_snapshot=self.snapshot)
                for relative, data in previous.items():
                    self.assertEqual((self.web / "dist" / relative).read_bytes(), data)
                path.write_bytes(original)

    def test_windows_checkout_line_endings_reproduce_release(self):
        for name in builder.SOURCE_FILES:
            (self.web / name).write_bytes(self.expected[name].replace(b"\n", b"\r\n"))
        builder.build(self.web, tarball=self.tarball, verify_snapshot=self.snapshot)
        for name in builder.SOURCE_FILES:
            self.assertEqual((self.web / "dist" / name).read_bytes(), self.expected[name])

    def test_corrupt_dependency_package_is_rejected_before_output(self):
        self.tarball.write_bytes(self.package + b"tampered")
        with self.assertRaisesRegex(ValueError, "package integrity mismatch"):
            builder.build(self.web, tarball=self.tarball)
        self.assertFalse((self.web / "dist").exists())

    def test_dependency_member_hash_is_still_required(self):
        self.lock["three"]["files"][0]["sha256"] = "0" * 64
        self.write_lock()
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            builder.build(self.web, tarball=self.tarball)
        self.assertFalse((self.web / "dist").exists())

    def test_cache_avoids_redownload_but_is_revalidated(self):
        with patch.object(builder, "urlopen", return_value=io.BytesIO(self.package)) as download:
            builder.build(self.web)
            download.assert_called_once()
        cache = self.web / ".cache/three-0.180.0.tgz"
        with patch.object(builder, "urlopen", side_effect=AssertionError("unexpected network")):
            builder.build(self.web)
            cache.write_bytes(b"broken cache")
            with self.assertRaisesRegex(ValueError, "package integrity mismatch"):
                builder.build(self.web)

    def test_dependency_output_cannot_escape_dist(self):
        self.lock["three"]["files"][0]["output"] = "../outside.js"
        self.write_lock()
        with self.assertRaisesRegex(ValueError, "Unsafe output path"):
            builder.build(self.web, tarball=self.tarball)
        self.assertFalse((self.web / "outside.js").exists())


class PreviewServerTests(unittest.TestCase):
    def test_busy_port_is_not_shared_and_falls_back_to_a_free_port(self):
        with builder.preview_server(0) as existing:
            with self.assertRaises(OSError):
                with builder.preview_server(existing.server_port):
                    pass
            with builder.preview_server(existing.server_port, fallback=True) as fallback:
                self.assertNotEqual(fallback.server_port, existing.server_port)
                self.assertEqual(fallback.server_address[0], "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
