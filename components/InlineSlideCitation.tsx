"use client";

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { citationsFromLabels } from "@/lib/recommendationCitations";

export default function InlineSlideCitation({ labels }: { labels: string[] }) {
  const citations = citationsFromLabels(labels);
  if (citations.length === 0) return null;

  return (
    <InlineCitation>
      <InlineCitationCard>
        <InlineCitationCardTrigger sources={citations.map((citation) => citation.url)} />
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <InlineCitationCarouselPrev />
              <InlineCitationCarouselNext />
              <InlineCitationCarouselIndex />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              {citations.map((citation) => (
                <InlineCitationCarouselItem key={`${citation.url}-${citation.label}`}>
                  <InlineCitationSource
                    title={citation.displayTitle}
                    url={citation.url}
                    description={citation.description}
                  />
                </InlineCitationCarouselItem>
              ))}
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}
