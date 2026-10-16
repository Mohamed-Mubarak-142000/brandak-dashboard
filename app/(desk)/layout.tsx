import { Rail } from "@/components/desk/rail";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Rail />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
