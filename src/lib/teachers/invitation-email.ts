const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function teacherInvitationEmail({ schoolName, teacherName, loginUrl }: { schoolName: string; teacherName: string; loginUrl: string }) {
  const subject = `${schoolName} invited you to Common Time`;
  const text = `Hi ${teacherName},\n\n${schoolName} has prepared your teacher access to Common Time. Open ${loginUrl} and request a sign-in code using this email address.\n\nYou will use email codes—there is no password to remember.`;
  const html = `<div style="background:#02060c;color:#e8f6ff;font-family:Arial,sans-serif;padding:32px"><div style="max-width:560px;margin:auto"><p style="color:#8da5b8">${escape(schoolName)}</p><h1 style="font-size:32px;font-weight:500">Your teacher access is ready.</h1><p style="line-height:1.6">Hi ${escape(teacherName)},</p><p style="line-height:1.6">${escape(schoolName)} has prepared your teacher access to Common Time. Use this email address to request a sign-in code. There is no password to remember.</p><p style="margin-top:28px"><a href="${escape(loginUrl)}" style="display:inline-block;background:#20a8e8;color:#02060c;padding:14px 20px;text-decoration:none">Open Common Time</a></p></div></div>`;
  return { subject, text, html };
}
