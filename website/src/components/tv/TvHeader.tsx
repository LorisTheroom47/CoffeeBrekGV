import BrandLogo from "@/components/BrandLogo";

type TvHeaderProps = {
  date: string;
  dateTime: string;
};

export default function TvHeader({ date, dateTime }: TvHeaderProps) {
  return (
    <header className="tv-header">
      <div>
        <BrandLogo className="tv-brand-logo" priority />
        <h1>Menu del giorno</h1>
      </div>
      <time className="tv-date" dateTime={dateTime}>
        {date}
      </time>
    </header>
  );
}
