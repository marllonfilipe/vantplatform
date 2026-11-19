"""Instala o modelo fixado. Somente o provisionamento requer acesso ao repositório de pesos."""
import json
import os
import shutil
import tempfile
import urllib.request
from pathlib import Path

spec = json.loads(Path(__file__).with_name("model.json").read_text())
root = Path(os.environ["VANT_MODEL_ROOT"])
root.mkdir(parents=True, exist_ok=True)
target = root / spec["revision"]
if not target.exists():
    staging = Path(tempfile.mkdtemp(dir=root))
    try:
        for remote, local in [(spec["artifact"], "model.onnx"), ("tokenizer.json", "tokenizer.json")]:
            url = f"https://huggingface.co/{spec['repository']}/resolve/{spec['revision']}/{remote}"
            with urllib.request.urlopen(url, timeout=90) as response, (staging / local).open("wb") as out:
                shutil.copyfileobj(response, out)
        staging.rename(target)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
print("Modelo disponível:", spec["revision"])
