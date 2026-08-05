export type MetodoPagamento = "pix" | "cartao";

export interface IniciarPagamentoInput {
  reservaEventoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface ResultadoPagamento {
  provedor: string;
  status: "aprovado" | "recusado" | "pendente";
  referenciaExterna: string;
}

export interface PaymentProvider {
  nome: string;
  iniciarPagamento(input: IniciarPagamentoInput): Promise<ResultadoPagamento>;
}
