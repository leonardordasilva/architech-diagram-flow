# Runbook Operacional — MicroFlow Architect

## 1. Monitoramento

### Health check
```bash
curl -s https://bbalunqbiwkvvvcnjmsh.supabase.co/functions/v1/health | jq .
```

**Resposta esperada:**
- `200` — `{ "status": "healthy", "checks": { "database": "ok", "encryption": "ok" } }`
- `503` — `{ "status": "degraded", "checks": { ... } }` — investigar campo com falha

**Frequência recomendada:** manual semanal ou via cron externo.

---

## 2. Manutenção de Banco

### Purge de soft-deleted diagrams
Executado automaticamente via pg_cron (semanalmente, domingos às 3h).

Para forçar manualmente:
```sql
SELECT public.purge_old_soft_deleted_diagrams();
```

### Purge de rate limits
```sql
SELECT public.purge_old_rate_limits();
```
Executado a cada 5 minutos via pg_cron (se configurado) ou manualmente.

### Verificar execuções do pg_cron
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## 3. Backfill de Criptografia

**Quando executar:** após migração de dados legados ou restore de backup.

```bash
curl -X POST \
  https://bbalunqbiwkvvvcnjmsh.supabase.co/functions/v1/backfill-encryption \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json"
```

**Resposta:** `{ "processed": N, "skipped": N, "errors": N, "total": N }`

Recomenda-se executar em horário de baixa atividade.

---

## 4. Troubleshooting Comum

### (a) Canvas em branco após save
**Causa provável:** payload criptografado recebido via realtime — o hook `useRealtimeCollab` ignora non-arrays.
**Solução:** recarregar a página.

### (b) content_hash mismatch warning
**Causa:** possível corrupção de dados.
**Ação:** verificar logs do edge function `save-diagram`, restaurar do backup se necessário.

### (c) Rate limit 429
**Solução:** aguardar 60 segundos. Se persistir, verificar se a tabela `rate_limits` tem entradas acumuladas:
```sql
SELECT * FROM public.rate_limits WHERE key LIKE '%<user_id>%';
```

### (d) DIAGRAM_LIMIT_EXCEEDED
**Causa:** usuário atingiu limite do plano.
**Solução:** upgrade de plano ou deletar diagramas existentes.

---

## 5. Atualização de Secrets

**Secrets configurados:**
- `DIAGRAM_ENCRYPTION_KEY` — chave AES-256 (Base64, 32 bytes)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — integração Stripe
- `SUPABASE_SERVICE_ROLE_KEY` — acesso admin ao banco
- `ALLOWED_ORIGINS` — origens permitidas para CORS
- `SITE_URL` — URL pública da aplicação
- `ADMIN_USER_IDS` — IDs de admin para backfill-encryption

**Procedimento:** Atualizar via Lovable Cloud > Settings > Secrets. Após atualizar, as Edge Functions fazem hot-reload automático.

---

## 6. Feature Flags

### Ativar/desativar uma flag
```sql
UPDATE public.feature_flags SET enabled = false WHERE key = 'atomic_save';
```

### Criar nova flag
```sql
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('new_feature', false, 'Description of the feature');
```

**Cache:** Flags são cacheadas no client por 10 minutos (`staleTime` do React Query).
