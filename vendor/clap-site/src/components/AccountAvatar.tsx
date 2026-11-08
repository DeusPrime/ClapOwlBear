export default function AccountAvatar({ username, avatar, className = "h-10 w-10" }: { username: string; avatar?: string | null; className?: string }) {
  return avatar ? <img src={avatar} alt="" className={`${className} rounded-full object-cover shrink-0 border border-ink/20`} /> :
    <span aria-hidden="true" className={`${className} rounded-full shrink-0 bg-accent/10 text-accent flex items-center justify-center font-bold border border-ink/20`}>{username.slice(0, 1).toUpperCase()}</span>;
}
