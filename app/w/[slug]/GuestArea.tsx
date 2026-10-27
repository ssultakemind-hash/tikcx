"use client";
import { useState } from "react";
import Uploader from "./Uploader";
import MyPhotos from "./MyPhotos";

export default function GuestArea({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <section className="card">
        {children}
        <Uploader slug={slug} onDone={() => setRefresh((n) => n + 1)} />
      </section>
      <MyPhotos slug={slug} refresh={refresh} />
    </>
  );
}
