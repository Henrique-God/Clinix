import { Activity } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const iconSize = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSize = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className="flex items-center gap-2">
      <div className="bg-gradient-primary p-2 rounded-lg">
        <Activity className={`${iconSize[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`${textSize[size]} font-bold text-foreground`}>
          Clinix
        </span>
      )}
    </div>
  );
}
