declare module "reactour" {
  import React from "react";

  export interface TourProps {
    steps: Array<{
      selector: string;
      content: React.ReactNode;
      position?: "top" | "bottom" | "left" | "right";
    }>;
    isOpen: boolean;
    onRequestClose: () => void;
    showNavigation?: boolean;
    showNavigationNumber?: boolean;
    showButtons?: boolean;
    showCloseButton?: boolean;
    showBadge?: boolean;
    disableInteraction?: boolean;
    disableDotsNavigation?: boolean;
    className?: string;
    maskClassName?: string;
    highlightedMaskClassName?: string;
  }

  const Tour: React.FC<TourProps>;
  export default Tour;
}
