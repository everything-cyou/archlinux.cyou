import S3 from 'aws-sdk/clients/s3';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import { useCallback, useRef, useState } from 'react';
import Edit from '../components/edit';
import { ErrorDialog } from '../components/error';
import { ShareLinkDialog } from '../components/home/ShareLinkDialog';
import Malleable, { FieldEdit } from '../components/malleable';
import Snapshot from '../components/snapshot';
import { useScrollReset } from '../hooks/use-scroll-reset';
import layoutStyles from '../styles/layout.module.css';

// Next.js automatically eliminates code used for `getStaticProps`!
// This code (and the `aws-sdk` import) will be absent from the final client-
// side JavaScript bundle(s).
const s3 = new S3({
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

export const getStaticProps: GetStaticProps = async ({
  // `preview` is a Boolean, specifying whether or not the application is in
  // "Preview Mode":
  preview,
  // `previewData` is only set when `preview` is `true`, and contains whatever
  // user-specific data was set in `res.setPreviewData`. See the API endpoint
  // that enters "Preview Mode" for more info (api/share/[snapshotId].tsx).
  previewData,
}) => {
  if (preview) {
    const { snapshotId } = previewData as { snapshotId: string };
    try {
      // In preview mode, we want to access the stored data from AWS S3.
      // Imagine using this to fetch draft CMS state, etc.
      const object = await s3
        .getObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `${snapshotId}.json`,
        })
        .promise();

      const contents = JSON.parse(object.Body.toString());
      return {
        props: { isPreview: true, snapshotId, contents },
      };
    } catch (e) {
      return {
        props: {
          isPreview: false,
          hasError: true,
          message:
            // 403 implies 404 in this case, as our IAM user has access to all
            // objects, but the bucket itself is private.
            e.statusCode === 403
              ? 'The requested preview edit does not exist!'
              : 'An error has occurred while connecting to S3. Please refresh the page to try again.',
        },
      };
    }
  }
  return { props: { isPreview: false } };
};

export default function Home(props) {
  // Scroll to top on mount as to ensure the user sees the "Preview Mode" bar
  useScrollReset();

  const [currentSnapshotId, setSnapshotId] = useState(null);
  const clearSnapshot = useCallback(() => setSnapshotId(null), [setSnapshotId]);

  const [isEdit, setEdit] = useState(false);
  const toggleEdit = useCallback(() => setEdit(!isEdit), [isEdit]);

  // Prevent duplication before re-render
  const hasSaveRequest = useRef(false);
  const [isSharingView, _setSharing] = useState(false);
  const setSharing = useCallback(
    (sharing: boolean) => {
      hasSaveRequest.current = sharing;
      _setSharing(sharing);
    },
    [hasSaveRequest, _setSharing]
  );

  const [currentError, setError] = useState<Error>(null);
  const onClearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const share = useCallback(() => {
    if (hasSaveRequest.current) return;
    setSharing(true);

    const els = document.querySelectorAll('[id] > [contenteditable=true]');
    const persistContents: FieldEdit[] = [].slice
      .call(els)
      .map(({ parentNode: { id }, innerText }) => ({ id, innerText }));

    self
      .fetch(`/api/save`, {
        method: 'POST',
        body: JSON.stringify(persistContents),
        headers: { 'content-type': 'application/json' },
      })
      .then((res) => {
        if (res.ok) return res.json();
        return new Promise(async (_, reject) =>
          reject(new Error(await res.text()))
        );
      })
      .then(({ snapshotId }) => {
        setSnapshotId(snapshotId);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setSharing(false);
      });
  }, []);

  const edits = props.isPreview ? props.contents : [];
  return (
    <>
      <Head>
        <title>ArchLinux.cyou</title>
        <meta
          name="description"
          content="Free subdomain for Arch Linux lovers!"
        ></meta>
      </Head>
      {currentError && (
        <ErrorDialog onExit={onClearError}>
          <p>
            An error occurred while saving your snapshot. Please try again in a
            bit.
          </p>
          <pre>{currentError.message}</pre>
        </ErrorDialog>
      )}
      {currentSnapshotId && (
        <ShareLinkDialog
          snapshotId={currentSnapshotId}
          onExit={clearSnapshot}
        />
      )}
      <div className={layoutStyles.layout}>
        {(props.isPreview || props.hasError) && (
          <aside role="alert">
            <a href="/api/exit">Preview Mode</a>
          </aside>
        )}
        {props.hasError ? (
          <>
            <h1>Oops</h1>
            <h2>Something unique to your preview went wrong.</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>
                The production website is <strong>still available</strong> and
                this does not affect other users.
              </p>
            </div>
            <hr />
            <h2>Reason</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>{props.message}</p>
            </div>
          </>
        ) : (
          <Content isEdit={isEdit} edits={edits} />
        )}
      </div>
      {isEdit ? (
        <>
          <Snapshot
            onCancel={toggleEdit}
            onShare={share}
            isSharing={isSharingView}
          />
        </>
      ) : (
        <Edit onClick={toggleEdit} />
      )}
    </>
  );
}

function Content({ isEdit, edits }: { isEdit: boolean; edits: FieldEdit[] }) {
  return (
    <>
      <Malleable id="title" as="h1" isActive={isEdit} edits={edits}>
      ArchLinux.cyou
      </Malleable>
      <div className="features">
        <div className="feature">
          <Malleable
            id="feature-1-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            💸
          </Malleable>
          <Malleable
            id="feature-1-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Forever free
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-2-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            📡
          </Malleable>
          <Malleable
            id="feature-2-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Always available(maybe)
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-3-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            💻
          </Malleable>
          <Malleable
            id="feature-3-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            For Arch Linux lovers
          </Malleable>
        </div>
      </div>
      <Malleable as="h2" id="title-2" isActive={isEdit} edits={edits}>
        Free subdomain for Arch Linux lovers!
      </Malleable>
      <div className="explanation">
        <div className="p">
        </div>
        <Malleable id="explanation-1" isActive={isEdit} edits={edits}>
        Your website just has to provide prove you are an Arch Linux user to get your own free ArchLinux.cyou subdomain for your website.<br />
        </Malleable>
        <Malleable as="h2" id="title-3" isActive={isEdit} edits={edits}>
        Start now?
      </Malleable>
      <Malleable id="explanation-2" isActive={isEdit} edits={edits}>
          Please go to our {' '}
          <a
            target="_blank"
            rel="noopener"
            href="https://github.com/archlinux-cyou/archlinux.cyou/issues"
          >
            Github repository 
          </a> {' '}
          to create a new issues.
        </Malleable>
        <Malleable as="h2" id="title-4" isActive={isEdit} edits={edits}>
        Warning
      </Malleable>
        <Malleable id="explanation-3" isActive={isEdit} edits={edits}>
          As the owner of the repository, you keep complete control over your published content. But that also means that all rights and duties that come along with publishing a website remain in your responsibility.
        </Malleable>
        <Malleable as="h2" id="title-5" isActive={isEdit} edits={edits}>
        Sponsor
      </Malleable>
      <Malleable id="explanation-4" isActive={isEdit} edits={edits}>
      TRC20-USDT:TLUYnuTD9BSq9qq5JxSsEczCDs2Ws7jPyQ<br />
        </Malleable>
      </div>
    </>
  );
}
