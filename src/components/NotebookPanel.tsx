import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2, RefreshCw, SquareStack, Trash2 } from "lucide-react";
import type { AppData, Notebook } from "../types/app";
import { exportAnkiDeck } from "../services/anki";

interface Props {
  data: AppData;
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function NotebookPanel({ data, activeNotebook, onData }: Props) {
  const [exportMessage, setExportMessage] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [srcbookUrl, setSrcbookUrl] = useState("");
  const [srcbookStatus, setSrcbookStatus] = useState<"loading" | "ready" | "error">("loading");
  const [srcbookError, setSrcbookError] = useState("");

  useEffect(() => {
    void startSrcbook();
  }, []);

  const startSrcbook = async () => {
    setSrcbookStatus("loading");
    setSrcbookError("");
    try {
      const result = await window.speakFirst.startSrcbookNotebook();
      setSrcbookUrl(result.url);
      setSrcbookStatus("ready");
    } catch (error) {
      setSrcbookStatus("error");
      setSrcbookError(error instanceof Error ? error.message : "Unable to start Srcbook.");
    }
  };

  const openSrcbook = async () => {
    setSrcbookError("");
    try {
      const result = await window.speakFirst.openSrcbookNotebook();
      setSrcbookUrl(result.url);
      setSrcbookStatus("ready");
    } catch (error) {
      setSrcbookStatus("error");
      setSrcbookError(error instanceof Error ? error.message : "Unable to open Srcbook.");
    }
  };

  const exportCards = async () => {
    const result = await exportAnkiDeck();
    setExportMessage(result.filePath ? `Exported ${result.cardCount} cards to ${result.filePath}` : "Export cancelled.");
  };

  const deleteCard = async (id: string) => {
    onData(await window.speakFirst.deleteFlashcard(id));
  };

  return (
    <section className="panel notebook-panel">
      <header className="panel-header">
        <div>
          <span className="eyebrow">Srcbook notebook</span>
          <h2>{activeNotebook.title}</h2>
          <p className="muted">Notebook editing is handled by Srcbook.</p>
        </div>
        <div className="panel-actions">
          <button onClick={() => void startSrcbook()}>
            <RefreshCw size={15} />
            Restart
          </button>
          <button onClick={() => void openSrcbook()}>
            <ExternalLink size={15} />
            Open
          </button>
          <button onClick={() => setCardsOpen(true)}>
            <SquareStack size={15} />
            Cards {data.flashcards.length > 0 ? `(${data.flashcards.length})` : ""}
          </button>
        </div>
      </header>

      <div className="srcbook-shell">
        {srcbookStatus === "loading" && (
          <div className="empty-state">
            <Loader2 className="spin" size={28} />
            <strong>Starting Srcbook...</strong>
            <span>SpeakFirst will use Srcbook for the notebook workspace.</span>
          </div>
        )}
        {srcbookStatus === "error" && (
          <div className="empty-state">
            <strong>Srcbook could not start.</strong>
            <span>{srcbookError}</span>
            <button onClick={() => void startSrcbook()}>Try again</button>
          </div>
        )}
        {srcbookStatus === "ready" && srcbookUrl && <iframe className="srcbook-frame" src={srcbookUrl} title="Srcbook notebook" />}
      </div>

      {cardsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card cards-modal" role="dialog" aria-modal="true" aria-label="Flashcards">
            <header>
              <div>
                <span className="eyebrow">Flashcards</span>
                <h2>{data.flashcards.length} cards</h2>
              </div>
              <div className="card-actions">
                <button onClick={exportCards}>
                  <Download size={15} />
                  Export
                </button>
                <button className="ghost-button" onClick={() => setCardsOpen(false)}>
                  Close
                </button>
              </div>
            </header>
            {exportMessage && <p className="muted">{exportMessage}</p>}
            <section className="cards-list in-modal">
              {data.flashcards.length === 0 ? (
                <p className="muted">No cards yet. Select chat or notebook text and use the Card button.</p>
              ) : (
                data.flashcards.map((card) => (
                  <article key={card.id} className="card-preview">
                    <div>
                      <span className="eyebrow">Front</span>
                      <p>{card.front}</p>
                    </div>
                    <div>
                      <span className="eyebrow">Back</span>
                      <p>{card.back}</p>
                    </div>
                    <button className="danger-button" onClick={() => deleteCard(card.id)} title="Delete card">
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))
              )}
            </section>
          </section>
        </div>
      )}
    </section>
  );
}
