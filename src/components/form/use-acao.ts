"use client";

import { useState, useTransition, type FormEvent } from "react";

/**
 * Envia um formulário para uma Server Action SEM a limpeza automática que o React faz em <form action>.
 * Útil em formulários longos: se a ação devolver erros, o que foi digitado continua nos campos.
 */
export function useAcao<S>(acao: (state: S, fd: FormData) => Promise<S>, inicial: S) {
  const [state, setState] = useState<S>(inicial);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setState(await acao(state, fd));
    });
  }

  return [state, onSubmit, pending] as const;
}
