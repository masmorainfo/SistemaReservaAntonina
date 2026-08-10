import styles from "./WizardProgress.module.css";

export interface WizardStep {
  key: string;
  label: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentKey: string;
}

export function WizardProgress({ steps, currentKey }: WizardProgressProps) {
  return (
    <ol className={styles.progress} aria-label="Etapas da reserva">
      {steps.map((step) => (
        <li
          key={step.key}
          className={styles.step}
          aria-current={step.key === currentKey ? "step" : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
