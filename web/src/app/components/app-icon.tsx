import { Icon } from "@iconify/react";

interface AppIconProps {
  icon: string;
  className?: string;
}

/**
 * Wrapper do Iconify para padronizar os ícones da interface.
 * Usa o conjunto Lucide, carregado sob demanda.
 * @see https://iconify.design/docs/icon-components/react/
 */
export function AppIcon({ icon, className }: AppIconProps) {
  return <Icon aria-hidden="true" className={className} icon={icon} />;
}
