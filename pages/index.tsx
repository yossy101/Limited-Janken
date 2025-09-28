import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <>
      <Head>
        <title>Limited Janken Control</title>
      </Head>
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-gradient-to-br from-night via-[#111a35] to-black">
        <motion.h1
          className="text-4xl md:text-6xl font-extrabold text-neon drop-shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          限定じゃんけん 管制室
        </motion.h1>
        <motion.p
          className="max-w-2xl text-lg text-gray-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          監視モニタとプレイヤーアプリにアクセスして、30人同時の熱狂をコントロールしましょう。
        </motion.p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/monitor"
            className="px-6 py-3 rounded-lg bg-cyber text-white font-semibold hover:bg-purple-500 transition"
          >
            モニタ画面
          </Link>
          <Link
            href="/player"
            className="px-6 py-3 rounded-lg bg-neon text-night font-semibold hover:bg-emerald-300 transition"
          >
            プレイヤー画面
          </Link>
        </div>
      </main>
    </>
  );
}
