import type { ReactNode } from "react";

type PlaceholderCardProps = {
  id: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export default function PlaceholderCard({
  id,
  title,
  description,
  children,
}: PlaceholderCardProps) {
  return (
    <section className="admin-placeholder-card" id={id}>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}
