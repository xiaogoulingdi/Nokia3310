#!/usr/bin/env python3
"""Reproduce the deployed static viewer using Python 3.10+ standard library."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

WEB = Path(__file__).resolve().parent


def checked(data, expected, label):
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch for {label}: {actual}")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, help="Optional model location; default is the existing repository GLB")
    parser.add_argument("--tarball", type=Path, help="Optional offline Three.js tarball; integrity is always checked")
    args = parser.parse_args()
    lock = json.loads((WEB / "dependencies.lock.json").read_text(encoding="utf-8"))
    model = args.model or WEB.parent / lock["model"]["repository_path"]
    # Validate every input before writing the output directory.
    files = {name: checked((WEB / name).read_bytes(), digest, name)
             for name, digest in lock["source_sha256"].items()}
    files["assets/nokia3310.glb"] = checked(model.read_bytes(), lock["model"]["sha256"], "model")
    dependency = lock["three"]
    if args.tarball:
        package = args.tarball.read_bytes()
    else:
        with urlopen(dependency["tarball"], timeout=60) as response:
            package = response.read()
    algorithm, expected = dependency["integrity"].split("-", 1)
    if algorithm != "sha512" or hashlib.sha512(package).digest() != base64.b64decode(expected, validate=True):
        raise ValueError("Three.js package integrity mismatch")
    with tarfile.open(fileobj=io.BytesIO(package), mode="r:gz") as archive:
        # Read only the allowlisted files; never extract archive paths to disk.
        for item in dependency["files"]:
            member = archive.getmember(item["member"])
            if not member.isfile():
                raise ValueError(f"Not a regular file: {member.name}")
            with archive.extractfile(member) as handle:
                files[item["output"]] = checked(handle.read(), item["sha256"], member.name)
    dist = WEB / "dist"
    for name, data in files.items():
        destination = dist / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    print(f"Verified and built {len(files)} files into web/dist")
    for name, data in sorted(files.items()):
        print(f"{hashlib.sha256(data).hexdigest()}  {name}")


if __name__ == "__main__":
    main()
