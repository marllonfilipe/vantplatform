CREATE INDEX documents_memory_page ON vant.documents (tenant_id, purpose, updated_at DESC, id);
