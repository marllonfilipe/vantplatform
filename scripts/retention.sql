-- Executar com conta operacional autorizada em janela de manutenção.
BEGIN;
DELETE FROM vant.sessions WHERE expires_at < now();
DELETE FROM vant.rate_limits WHERE window_start < now() - interval '1 day';
DELETE FROM vant.invitations WHERE expires_at < now() - interval '30 days';
COMMIT;
