import Markdown from 'react-markdown';

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({
    content,
}: MarkdownPreviewProps) {
    return (
        <div className="markdown-preview">
            <Markdown skipHtml disallowedElements={['img']}>{content}</Markdown>
        </div>
    );
  }

