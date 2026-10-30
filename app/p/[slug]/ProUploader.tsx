"use client";
import Uploader from "../../w/[slug]/Uploader";

export default function ProUploader({ slug, k }: { slug: string; k: string }) {
  return <Uploader slug={slug} adminKey={k} />;
}
