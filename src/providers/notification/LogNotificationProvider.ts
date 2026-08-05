import { NotificationProvider, NotificacaoInput } from "./NotificationProvider";

export class LogNotificationProvider implements NotificationProvider {
  nome = "log";
  public enviados: NotificacaoInput[] = [];

  async enviar(input: NotificacaoInput): Promise<void> {
    this.enviados.push(input);
  }
}
