type PowerIconProps = {
  size?: number;
  className?: string;
};

const PowerIcon = ({ size = 17, className = "" }: PowerIconProps) => (
  <svg width={(size * 17) / 35} height={size} viewBox="0 0 17 35" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <g clipPath="url(#power-icon-clip)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.61949 17.9785L0 17.0927L5.48787 0H12.9906L8.73653 9.80672L16.3895 11.0116L2.34136 35L6.61949 17.9785Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="power-icon-clip">
        <rect width="16.3895" height="35" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export default PowerIcon;
