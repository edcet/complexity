import { useQuery } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { threadMessageBlocksDomObserverStore } from "@/plugins/__core__/dom-observers/thread/message-blocks/store";
import { DomSelectorsService } from "@/plugins/__core__/dom-selectors/service-init.loader";
import { PplxThreadExport } from "@/plugins/__core__/pplx-thread-export";
import { PplxLanguageModelsService } from "@/services/externals/cplx-api/remote-resources/pplx-language-models";
import type { ThreadMessageApiResponse } from "@/services/externals/pplx-api/pplx-api.types";
import { pplxApiQueries } from "@/services/externals/pplx-api/query-keys";
import { parseUrl } from "@/utils/misc/utils";
import { dualClipboardPut } from "@/utils/wrappers/clipboard-utils";
import { errorWrapper } from "@/utils/wrappers/error-wrapper";
import { EXPORT_TEMPLATES } from "../export-options";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Converter } from "showdown";

type FetchFn = () => Promise<ThreadMessageApiResponse[] | undefined>;

type CopyMessageParams = {
  messageBlockIndex: number;
  withCitations: boolean;
  onComplete?: () => void;
};

type GetContentParams = {
  withCitations: boolean;
  messageBlockIndex?: number;
  format?: string;
  template?: string;
};

type ExportFormat = "markdown" | "pdf" | "html";

export function useCopyPplxThread() {
  const threadSlug = parseUrl().pathname.split("/").pop() || "";
  const { isFetching, refetch } = useQuery({
    ...pplxApiQueries.thread.detail(threadSlug),
    enabled: false,
  });

  const fetchFn = async () => (await refetch()).data;

  return {
    isFetching,
    copyMessage: async function copyMessage({
      messageBlockIndex,
      withCitations,
      onComplete,
    }: CopyMessageParams) {
      try {
        if (withCitations) {
          await copyMessageWithCitations({ messageBlockIndex });
        } else {
          await copyMessageWithoutCitations({ messageBlockIndex, fetchFn });
        }
        onComplete?.();
      } catch (error) {
        toast({
          title: "❌ Failed to copy message",
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
    copyThread: async function copyThread({
      withCitations,
      onComplete,
    }: {
      withCitations: CopyMessageParams["withCitations"];
      onComplete?: CopyMessageParams["onComplete"];
    }) {
      if (withCitations) {
        await copyThreadWithCitations({ fetchFn });
      } else {
        await copyThreadWithoutCitations({ fetchFn });
      }
      onComplete?.();
    },
    getContent: async function getContent({
      withCitations,
      messageBlockIndex,
      format = "markdown",
      template,
    }: GetContentParams) {
      const threadJson = await fetchFn();
      if (threadJson == null) {
        throw new Error("Failed to fetch thread info");
      }
      
      let content = new PplxThreadExport({
        languageModels: PplxLanguageModelsService.allModelsFlat,
      }).exportThread({
        threadJSON: threadJson,
        includeCitations: withCitations,
        messageIndex: messageBlockIndex,
      });

      // Apply template if specified
      if (template && EXPORT_TEMPLATES[template]) {
        const templateConfig = EXPORT_TEMPLATES[template];
        const threadTitle = threadJson[0]?.query || "Thread Export";
        const header = templateConfig.header
          .replace("{date}", new Date().toISOString().split("T")[0])
          .replace("{title}", threadTitle);
        content = header + content;
      }

      return content;
    },
    exportPDF: async function exportPDF({
      withCitations,
      messageBlockIndex,
      template,
    }: GetContentParams) {
      try {
        // Get the thread content element
        const threadContent = document.querySelector("[class*='ThreadContent']") as HTMLElement;
        if (!threadContent) {
          throw new Error("Thread content not found");
        }

        // Create canvas from the thread content
        const canvas = await html2canvas(threadContent, {
          scale: 2,
          useCORS: true,
          logging: false,
        });

        // Create PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;

        // Add additional pages if needed
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(
            canvas.toDataURL("image/png"),
            "PNG",
            0,
            position,
            imgWidth,
            imgHeight
          );
          heightLeft -= pageHeight;
        }

        // Download the PDF
        const threadJson = await fetchFn();
        const threadTitle = threadJson?.[0]?.query || "thread-export";
        const filename = `${threadTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
        pdf.save(filename);

        toast({
          title: "✅ PDF exported successfully",
          description: `Saved as ${filename}`,
        });
      } catch (error) {
        toast({
          title: "❌ Failed to export PDF",
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
        throw error;
      }
    },
    exportWithFormat: async function exportWithFormat({
      format,
      withCitations,
      messageBlockIndex,
      template,
    }: GetContentParams & { format: ExportFormat }) {
      if (format === "pdf") {
        return await this.exportPDF({ withCitations, messageBlockIndex, template });
      }

      const content = await this.getContent({
        withCitations,
        messageBlockIndex,
        format,
        template,
      });

      if (format === "html") {
        const converter = new Converter({
          tables: true,
          tasklists: true,
          strikethrough: true,
          ghCodeBlocks: true,
        });
        return converter.makeHtml(content);
      }

      return content;
    },
  };
}

async function copyMessageWithCitations({
  messageBlockIndex,
}: {
  messageBlockIndex: number;
}) {
  const content =
    threadMessageBlocksDomObserverStore.getState().messageBlocks?.[
      messageBlockIndex
    ]?.content;

  if (content == null) {
    const $footer =
      threadMessageBlocksDomObserverStore.getState().messageBlocks?.[
        messageBlockIndex
      ]?.nodes.$footer;

    if (!$footer || !$footer.length) return;

    const $copyButton = $footer.find(
      DomSelectorsService.Root.cachedSync.THREAD.MESSAGE.FOOTER_CHILD
        .COPY_BUTTON,
    );

    if (!$copyButton.length) return;
    $copyButton.trigger("click");
    return;
  }

  const cleanAnswer = content.answer.replace(
    /\[(.*?)\]\(pplx:\/\/action\/followup\)/g,
    "$1",
  );

  if (content.webResults != null && content.webResults.length) {
    void dualClipboardPut({
      markdown: `${cleanAnswer}\n\nCitations:\n${PplxThreadExport.formatWebResults(content.webResults)}`,
    });
  } else {
    void dualClipboardPut({
      markdown: cleanAnswer,
    });
  }
}

async function copyMessageWithoutCitations({
  messageBlockIndex,
  fetchFn,
}: {
  messageBlockIndex: number;
  fetchFn: FetchFn;
}) {
  void copyContent({
    messageBlockIndex,
    fetchFn,
    withCitations: false,
  });
}

async function copyThreadWithCitations({ fetchFn }: { fetchFn: FetchFn }) {
  return copyContent({ fetchFn, withCitations: true });
}

async function copyThreadWithoutCitations({ fetchFn }: { fetchFn: FetchFn }) {
  return copyContent({ fetchFn, withCitations: false });
}

async function copyContent({
  withCitations,
  messageBlockIndex,
  fetchFn,
}: {
  withCitations: boolean;
  messageBlockIndex?: number;
  fetchFn: FetchFn;
}) {
  if (fetchFn == null) {
    throw new Error("Fetch function not provided");
  }

  const threadJson = await fetchFn();
  if (threadJson == null) {
    throw new Error("Failed to fetch thread info");
  }

  const message = new PplxThreadExport({
    languageModels: PplxLanguageModelsService.allModelsFlat,
  }).exportThread({
    threadJSON: threadJson,
    includeCitations: withCitations,
    messageIndex: messageBlockIndex,
  });

  const [, error] = await errorWrapper(() =>
    dualClipboardPut({ markdown: message }),
  )();

  if (error) {
    console.error(error);
    throw new Error("Please click/focus on the page while copying!");
  }
}
