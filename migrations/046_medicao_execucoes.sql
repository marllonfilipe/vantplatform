CREATE INDEX automation_attempts_by_day ON vant.automation_attempts(tenant_id,created_at,job_id);
CREATE INDEX automation_attempts_first_action ON vant.automation_attempts(tenant_id,job_id,attempt)
 WHERE outcome <> 'skipped';

-- A primeira tentativa de ação de cada job define o dia da sua execução.
CREATE FUNCTION vant.flow_execution_usage(company uuid, local_day date)
RETURNS TABLE(started bigint, attempts bigint, retries bigint, skipped bigint)
LANGUAGE sql STABLE AS $$
 SELECT count(*) FILTER (WHERE a.outcome <> 'skipped' AND NOT EXISTS (
          SELECT 1 FROM vant.automation_attempts prior
          WHERE prior.tenant_id=a.tenant_id AND prior.job_id=a.job_id
            AND prior.attempt<a.attempt AND prior.outcome <> 'skipped')),
        count(*) FILTER (WHERE a.outcome <> 'skipped'),
        count(*) FILTER (WHERE a.outcome='retry'),
        count(*) FILTER (WHERE a.outcome='skipped')
 FROM vant.automation_attempts a
 WHERE company=vant.current_tenant() AND a.tenant_id=company
   AND a.created_at >= (local_day::timestamp AT TIME ZONE 'America/Sao_Paulo')
   AND a.created_at < ((local_day+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
$$;
