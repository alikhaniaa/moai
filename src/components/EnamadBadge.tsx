/**
 * نماد اعتماد الکترونیکی (eNamad) trust seal.
 *
 * eNamad's crawler verifies that this exact snippet - including the `code`
 * attribute on the <img> - is present on the site, so it is embedded verbatim
 * via dangerouslySetInnerHTML rather than rewritten as JSX (React would strip
 * the non-standard `code`/`referrerpolicy` attributes).
 */
const SEAL = `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=726163&Code=pK5me56gsId8DVNdAV1NucwXzrTR3fLY'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=726163&Code=pK5me56gsId8DVNdAV1NucwXzrTR3fLY' alt='نماد اعتماد الکترونیکی موآی گالری' style='cursor:pointer;max-width:100px;height:auto' code='pK5me56gsId8DVNdAV1NucwXzrTR3fLY'></a>`;

export default function EnamadBadge() {
  return <div dangerouslySetInnerHTML={{ __html: SEAL }} />;
}
