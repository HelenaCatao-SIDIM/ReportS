-- A conexão com o n8n não usa mais chave: apaga a que uma versão anterior pode ter guardado (cifrada).
DELETE FROM "configuracoes" WHERE "chave" = 'n8n.resumo_chamados.chave';
