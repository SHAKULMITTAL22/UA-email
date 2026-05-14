import { ThreadView } from "@/components/thread-view";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <ThreadView threadId={decodeURIComponent(threadId)} />
    </div>
  );
}
