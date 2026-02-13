import { fetchWithAuth } from "@/lib/apiClient"
import { useCallback, useRef, useState } from "react"

interface UseSseStreamOptions {
    sessionId: string,
    content: string,
    onEvent: (eventName: string, payload: unknown) => any
}

interface UseSseStreamResult {
    startStream: (options: UseSseStreamOptions) => Promise<void>;
    stopStream: () => void;
    isStreaming: boolean;
    streamError: string | null;
}

export const useSseStream = (): UseSseStreamResult => {
    const abortControllerRef = useRef<AbortController | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);

    const stopStream = useCallback((): void => {
        if (abortControllerRef.current) {
            const controller = abortControllerRef.current;
            controller.abort();
            abortControllerRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    const startStream = useCallback(async ({ sessionId, content, onEvent }: UseSseStreamOptions) => {
        // abort previous request
        stopStream();
        // apply new abort controller to abortControllerRef
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setIsStreaming(true);
        setStreamError(null);

        try {
            // fetch stream data from server
            const res = await fetchWithAuth(`/api/sessions/${sessionId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content, stream: true }),
                headers: {
                    Accept: "text/event-stream"
                }
            });

            // handle response error
            if (!res.ok || res.body === null) {
                const errBody = await res.json().catch(() => { error: { message: `HTTP ${res.status}` } });
                const message = typeof errBody?.error?.message === 'string' ? errBody?.error?.message : `HTTP ${res.status}`;
                throw new Error(message);
            }

            // read stream data
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = ""

            while (true) {
                const { done, value } = await reader.read();

                // end of stream
                if (done) break;

                /**
                 * event: message.created
                    data: {"user_message_id":"10001"}

                    event: assistant.delta
                    data: {"delta":"是"}

                    event: assistant.done
                    data: {"assistant_message_id":"10002","content":"是","answer_type":"YES"}
                 */
                buffer += decoder.decode(value, { stream: true });
                let separatorIndex = buffer.indexOf("\n\n");
                while (separatorIndex !== -1) {
                    const rawEvent = buffer.slice(0, separatorIndex);

                    buffer = buffer.slice(separatorIndex + 2);

                    // assemble data
                    let eventName = "message";
                    let dataText = "";
                    const lines = rawEvent.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("event:")) {
                            eventName = line.slice("event:".length).trim();
                        } else if (line.startsWith("data:")) {
                            const chunk = line.slice("data:".length).trim();
                            dataText = dataText ? `${dataText}\n${chunk}` : chunk;
                        }
                    }
                    if (dataText) {
                        let parsed: unknown = dataText;
                        try {
                            parsed = JSON.parse(dataText);
                        } catch {
                            parsed = dataText;
                        }
                        onEvent(eventName, parsed);
                    }
                    separatorIndex = buffer.indexOf("\n\n");
                }
            }
        } catch (error) {
            if ((error as { name?: string } | null)?.name === "AbortError") {
                return;
            }
            const message = error instanceof Error && error.message ? error.message : "流式回复出错，请稍后重试。";
            setStreamError(message);
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    }, [stopStream])

    return {
        stopStream,
        startStream,
        streamError,
        isStreaming
    }
}