import { notFound } from "next/navigation";
import { weddingBySlug } from "@/lib/supabase";
import LiveScreen from "./LiveScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "tikcx. 실시간 화면" };

// Full-screen page for a monitor in the bridal room: guests' photos as a slideshow + a big QR.
export default async function Live({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await weddingBySlug(slug);
  if (!w) notFound();
  return <LiveScreen slug={w.slug} names={w.couple_names} />;
}
