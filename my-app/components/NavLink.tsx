"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  (
    { className, activeClassName, pendingClassName, href, children, ...props },
    ref,
  ) => {
    const pathname = usePathname() || "/";
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
      <Link href={href} legacyBehavior>
        <a
          ref={ref}
          className={cn(className, isActive && activeClassName)}
          {...props}
        >
          {children}
        </a>
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
