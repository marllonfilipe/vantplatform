ALTER TABLE vant.plan_assignments ADD COLUMN agent_actions_per_day integer
 CHECK (agent_actions_per_day BETWEEN 0 AND 10000);

-- Uma única definição de dia e capacidade para a reserva e o painel financeiro.
CREATE FUNCTION vant.daily_agent_capacity(company uuid)
RETURNS TABLE(used_today integer, operational_limit integer, contract_limit integer, effective_limit integer)
LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN c.usage_day=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date THEN c.used ELSE 0 END,
        coalesce(c.daily_limit,100), p.agent_actions_per_day,
        least(coalesce(c.daily_limit,100),p.agent_actions_per_day)
 FROM (SELECT company AS id) t
 LEFT JOIN vant.agent_controls c ON c.tenant_id=t.id
 LEFT JOIN LATERAL (
  SELECT a.agent_actions_per_day FROM vant.plan_assignments a
  WHERE a.tenant_id=t.id ORDER BY a.revision DESC LIMIT 1
 ) p ON true
 WHERE t.id=vant.current_tenant()
$$;
