import { motion } from "framer-motion";

export function TradePanel() {
  return (
    <motion.div
      className="bg-[#151f3f]/60 border border-dashed border-[#2a3a6a] rounded-2xl p-5 text-center text-gray-400"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h2 className="text-xl font-semibold text-neon mb-2">トレード（M2で有効化）</h2>
      <p className="text-sm">
        トレードと敗北判定は次フェーズで実装予定です。UIは先行して配置されています。
      </p>
    </motion.div>
  );
}
