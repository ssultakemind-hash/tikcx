import Gallery from "./Gallery";

export default async function CouplePage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string; from?: string }>;
}) {
  const { slug } = await params;
  const { k, from } = await searchParams;
  return <Gallery slug={slug} k={k ?? ""} fromAdmin={from === "admin"} />;
}
