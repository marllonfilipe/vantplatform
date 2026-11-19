"""Processo de inferência local; dados de clientes entram e saem pelo pipe privado."""
import json
import os
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

spec = json.loads(Path(__file__).with_name("model.json").read_text())
directory = Path(os.environ["VANT_MODEL_ROOT"]) / spec["revision"]
opts = ort.SessionOptions()
opts.intra_op_num_threads = max(1, min(int(os.getenv("VANT_MODEL_THREADS", "2")), 8))
opts.inter_op_num_threads = 1
model = ort.InferenceSession(str(directory / "model.onnx"), opts, providers=["CPUExecutionProvider"])
tokenizer = Tokenizer.from_file(str(directory / "tokenizer.json"))
tokenizer.enable_truncation(max_length=spec["max_tokens"])
tokenizer.enable_padding(pad_id=tokenizer.token_to_id("<pad>") or 0)
inputs = {i.name for i in model.get_inputs()}

def encode(texts):
    if not 1 <= len(texts) <= 64 or any(not isinstance(t,str) or len(t)>10000 for t in texts):
        raise ValueError("batch")
    outputs = []
    for start in range(0, len(texts), 8):
        records = tokenizer.encode_batch(texts[start:start + 8])
        mask = np.asarray([r.attention_mask for r in records], dtype=np.int64)
        feed = {"input_ids": np.asarray([r.ids for r in records], dtype=np.int64), "attention_mask": mask}
        if "token_type_ids" in inputs:
            feed["token_type_ids"] = np.asarray([r.type_ids for r in records], dtype=np.int64)
        hidden = model.run(None, feed)[0]
        pooled = (hidden * mask[:,:,None]).sum(axis=1) / mask.sum(axis=1,keepdims=True).clip(1)
        normalized = pooled / np.linalg.norm(pooled,axis=1,keepdims=True).clip(1e-9)
        if normalized.shape[1] != spec["dimensions"] or not np.isfinite(normalized).all():
            raise ValueError("embedding")
        outputs.extend(normalized.astype(np.float32).tolist())
    return outputs

for line in sys.stdin:
    try:
        result = {"vectors": encode(json.loads(line)["texts"])}
    except Exception:
        result = {"error": "inference"}
    print(json.dumps(result, separators=(",", ":")), flush=True)
