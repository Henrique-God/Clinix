import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <div className="stepper-step">
              <div
                className={cn(
                  "stepper-circle",
                  isActive && "active",
                  isCompleted && "completed",
                  isPending && "pending"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:block",
                  isActive && "text-primary",
                  isCompleted && "text-primary",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-12 h-0.5 mx-2",
                  index < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
