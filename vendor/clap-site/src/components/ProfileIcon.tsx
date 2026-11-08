import type { SVGProps } from "react";

type ProfileIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const ProfileIcon = ({ size = 24, style, ...props }: ProfileIconProps) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    {...props}
  >
    <rect x="5" y="3" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <path d="M9 7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 17c.45-2.15 1.82-3.2 4-3.2s3.55 1.05 4 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="11" r="2.2" fill="currentColor" />
  </svg>
);

export default ProfileIcon;
