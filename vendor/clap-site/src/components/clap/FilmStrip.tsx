const FilmStrip = ({ className = "" }: { className?: string }) => (
  <div className={`film-strip w-full ${className}`} aria-hidden />
);

export default FilmStrip;
