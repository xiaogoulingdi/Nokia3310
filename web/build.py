#!/usr/bin/env python3
"""Build the current viewer; optionally verify a historical release snapshot."""
import argparse
import base64
import errno
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path, PurePosixPath
import socket
import tarfile
from urllib.request import urlopen
import webbrowser

WEB = Path(__file__).resolve().parent
SOURCE_FILES = ("index.html", "style.css", "app.js", "interaction.js")
MODEL_PATH = Path("Blender工程/网页模型/nokia3310_interactive_v1.glb")


def checked(data, expected, label):
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch for {label}: {actual}")
    return data


def output_path(dist, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in name or ":" in name:
        raise ValueError(f"Unsafe output path: {name}")
    destination = dist / name
    if not destination.resolve().is_relative_to(dist.resolve()):
        raise ValueError(f"Output escapes dist: {name}")
    return destination


def build(web=WEB, model=None, tarball=None, verify_snapshot=None):
    lock = json.loads((web / "dependencies.lock.json").read_text(encoding="utf-8"))
    dependency = lock["three"]
    # Project sources are editable; integrity checks remain mandatory for dependencies.
    # Canonical LF output avoids Windows Git autocrlf changing release bytes.
    files = {name: (web / name).read_bytes().replace(b"\r\n", b"\n") for name in SOURCE_FILES}
    files["assets/nokia3310.glb"] = (model or web.parent / MODEL_PATH).read_bytes()
    cache = web / ".cache" / f"three-{dependency['version']}.tgz"
    if tarball:
        package = tarball.read_bytes()
    elif cache.is_file():
        package = cache.read_bytes()
    else:
        with urlopen(dependency["tarball"], timeout=60) as response:
            package = response.read()
    algorithm, expected = dependency["integrity"].split("-", 1)
    if algorithm != "sha512" or hashlib.sha512(package).digest() != base64.b64decode(expected, validate=True):
        raise ValueError("Three.js package integrity mismatch (check the supplied tarball or web/.cache)")
    with tarfile.open(fileobj=io.BytesIO(package), mode="r:gz") as archive:
        # Only read allowlisted regular files; never extract arbitrary archive paths.
        for item in dependency["files"]:
            name = item["output"]
            output_path(web / "dist", name)
            if name in files or name == "build-manifest.json":
                raise ValueError(f"Duplicate or reserved output: {name}")
            member = archive.getmember(item["member"])
            if not member.isfile():
                raise ValueError(f"Not a regular file: {member.name}")
            with archive.extractfile(member) as handle:
                files[name] = checked(handle.read(), item["sha256"], member.name)
    if verify_snapshot:
        snapshot = json.loads(verify_snapshot.read_text(encoding="utf-8"))
        expected_files = snapshot["files_sha256"]
        if set(files) != set(expected_files):
            raise ValueError("Snapshot file list differs from the current build")
        for name, data in files.items():
            checked(data, expected_files[name], f"snapshot: {name}")
    manifest = {
        "schema_version": 1,
        "three_version": dependency["version"],
        "verified_snapshot": verify_snapshot.name if verify_snapshot else None,
        "files": {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                  for name, data in sorted(files.items())},
    }
    files["build-manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    destinations = {name: output_path(web / "dist", name) for name in files}
    # All input validation finishes before changing dist or the download cache.
    if not tarball and not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(package)
    for name, data in files.items():
        destination = destinations[name]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    return manifest


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class PreviewServer(ThreadingHTTPServer):
    # Windows must not silently share a listening port with another preview.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def preview_server(port, fallback=False):
    handler = partial(PreviewHandler, directory=str(WEB / "dist"))
    try:
        return PreviewServer(("127.0.0.1", port), handler)
    except OSError as error:
        if not fallback or error.errno not in (errno.EADDRINUSE, 10048, 10013):
            raise
        print(f"Port {port} is unavailable; choosing an available local port.")
        return PreviewServer(("127.0.0.1", 0), handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, help="Use an alternate current GLB")
    parser.add_argument("--tarball", type=Path, help="Use an offline Three.js tarball; integrity is always checked")
    parser.add_argument("--verify-snapshot", type=Path, help="Require exact runtime-file hashes from a release snapshot")
    parser.add_argument("--serve", type=int, metavar="PORT", help="After building, preview on 127.0.0.1 at this port")
    parser.add_argument("--open-browser", action=argparse.BooleanOptionalAction, default=False,
                        help="Open the preview in your browser; choose a free port if the requested one is busy")
    args = parser.parse_args()
    if args.open_browser and args.serve is None:
        parser.error("--open-browser requires --serve PORT")
    manifest = build(model=args.model, tarball=args.tarball, verify_snapshot=args.verify_snapshot)
    print(f"Built {len(manifest['files'])} runtime files and build-manifest.json into web/dist")
    print(f"Three.js {manifest['three_version']}: package and file integrity verified")
    if args.verify_snapshot:
        print(f"Release snapshot verified: {args.verify_snapshot.name}")
    else:
        print("Development build: using current project sources and model")
    if args.serve is not None:
        with preview_server(args.serve, fallback=args.open_browser) as server:
            url = f"http://127.0.0.1:{server.server_port}/"
            print(f"Preview: {url} (Ctrl+C to stop)", flush=True)
            if args.open_browser:
                try:
                    if not webbrowser.open(url):
                        print("Please open the preview URL above in your browser.")
                except webbrowser.Error:
                    print("Could not open a browser automatically; use the preview URL above.")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == "__main__":
    main()
