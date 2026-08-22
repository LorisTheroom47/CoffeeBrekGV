import Image from "next/image";

type BrandLogoProps = Readonly<{
  className: string;
  priority?: boolean;
}>;

export default function BrandLogo({
  className,
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      className={className}
      src="/images/coffee-break-gv-logo.png"
      alt="Coffee Break GV"
      width={1672}
      height={941}
      priority={priority}
    />
  );
}
