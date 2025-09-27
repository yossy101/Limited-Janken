import Link from "next/link";

const HomePage = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-brand-dark to-slate-900 p-6 text-center">
      <h1 className="text-4xl font-black tracking-tight">限定じゃんけんコントロールパネル</h1>
      <p className="max-w-xl text-lg text-slate-200">
        モニター画面とプレイヤー画面をそれぞれ開いて、部屋の進行とプレイを管理します。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/monitor" className="rounded-xl bg-brand px-6 py-4 text-xl font-semibold shadow-lg shadow-brand/30 transition hover:scale-105">
          モニターを開く
        </Link>
        <Link href="/player" className="rounded-xl bg-slate-800 px-6 py-4 text-xl font-semibold shadow-lg shadow-black/40 transition hover:scale-105">
          プレイヤー画面を開く
        </Link>
      </div>
    </main>
  );
};

export default HomePage;
