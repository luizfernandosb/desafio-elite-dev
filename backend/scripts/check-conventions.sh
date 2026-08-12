#!/usr/bin/env bash
# Convenções do Anexo A (etapa 14, §7.10.9): "convenção verificada por script é
# convenção; verificada por boa vontade é sugestão." Roda em `npm run
# check:conventions` e como passo do CI -- qualquer achado real derruba o build.
set -uo pipefail
cd "$(dirname "$0")/.." # sempre a partir de backend/, venha o script de onde vier

FAILED=0

check_empty() {
  local description="$1"
  local output="$2"
  if [ -n "$output" ]; then
    echo "✗ $description"
    echo "$output" | sed 's/^/    /'
    FAILED=1
  else
    echo "✓ $description"
  fi
}

check_empty "console.log em backend/src" \
  "$(grep -rn 'console\.log' src/ 2>/dev/null)"

# process.env fora de config/env.ts é o que se quer pegar em código de produção --
# arquivos de teste legitimamente simulam rotação de segredo (ex.: qr.service.unit.test.ts,
# "trocar o segredo de assinatura invalida um código já emitido"), então ficam de fora.
check_empty "process.env fora de config/env.ts (produção)" \
  "$(grep -rln 'process\.env' src/ 2>/dev/null | grep -v 'src/config/env\.ts$' | grep -v '\.test\.ts$')"

check_empty "@prisma/client importado direto em controller" \
  "$(grep -rln '@prisma/client' src/modules/*/*controller* 2>/dev/null)"

check_empty "express importado em service" \
  "$(grep -rln "from 'express'" src/modules/*/*service* 2>/dev/null)"

check_empty "parseFloat em código de dinheiro" \
  "$(grep -rn 'parseFloat' src/ 2>/dev/null)"

check_empty "throw new Error(...) cru em service (deveria ser AppError)" \
  "$(grep -rn 'throw new Error(' src/modules/*/*service* 2>/dev/null)"

# "sk_" sozinho dá falso positivo garantido: bate em todo STRIPE_SECRET_KEY=sk_test_placeholder
# de .env*.example e no próprio z.string().startsWith('sk_') do validador -- nenhum dos
# dois é o segredo que se quer achar. Uma secret key real da Stripe é sk_(live|test)_
# seguida de ~24+ caracteres alfanuméricos; nenhum placeholder do repo bate nisso.
check_empty "chave real da Stripe (sk_live_/sk_test_ + 24+ chars) no histórico do git" \
  "$(git -C .. log -p -S 'sk_' --all 2>/dev/null | grep -oE 'sk_(live|test)_[A-Za-z0-9]{24,}' | sort -u)"

if [ -d ../frontend/dist ]; then
  check_empty "service_role no bundle do front" \
    "$(grep -rl 'service_role' ../frontend/dist/ 2>/dev/null)"
else
  echo "· service_role no bundle do front -- pulado (frontend/dist ainda não existe)"
fi

echo ''
if [ "$FAILED" -eq 0 ]; then
  echo 'Todas as convenções do Anexo A passaram.'
else
  echo 'Uma ou mais convenções falharam -- ver ✗ acima.'
fi
exit "$FAILED"
