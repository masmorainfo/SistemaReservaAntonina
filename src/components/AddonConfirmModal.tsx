"use client";

import { useEffect, useRef } from "react";
import styles from "./AddonConfirmModal.module.css";

interface AddonConfirmModalProps {
  open: boolean;
  pacoteNome: string;
  valorBase: number;
  valorAddon: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AddonConfirmModal({
  open,
  pacoteNome,
  valorBase,
  valorAddon,
  onConfirm,
  onCancel,
}: AddonConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.open = true;
      }
    } else if (!open && dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.open = false;
      }
    }
  }, [open]);

  const valorTotal = valorBase + valorAddon;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialogo}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h3 className={styles.titulo}>Confirmar Telão &amp; Projetor</h3>
      <p>
        {pacoteNome} — R$ {valorBase.toFixed(2)}
      </p>
      <p>Telão &amp; Projetor — R$ {valorAddon.toFixed(2)}</p>
      <p className={styles.total}>Total: R$ {valorTotal.toFixed(2)}</p>
      <div className={styles.acoes}>
        <button type="button" className={styles.botaoCancelar} onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={styles.botaoConfirmar} onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
