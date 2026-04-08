const THANK_YOU_FALLBACK = 'https://edefterotomasyon.com.tr/download-thanks.html';

function text(value) {
  return String(value || '').trim();
}

async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo hata: ${res.status} ${body}`);
  }
}

async function createOrUpdateContact(apiKey, payload) {
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo contact hata: ${res.status} ${body}`);
  }
}

function buildCustomerMail(data) {
  const firma = data.company || 'degerli musteri';
  return {
    subject: 'E-Defter Otomasyon | Demo Talebiniz Alindi',
    text:
      `Sayin ${firma},\n\n` +
      'Demo talebiniz alinmistir. Indirme linki asagidadir:\n' +
      `${data.demoUrl}\n\n` +
      'Kurulum videosu: https://www.youtube.com/watch?v=sGD8BrVTwI8\n' +
      'Cihaz kimligi nasil alinir: https://www.youtube.com/watch?v=Bcc4_BaMpOc\n\n' +
      'Herhangi bir sorunuz olursa bize yazabilirsiniz.\n' +
      'Saygilarimizla,\nE-Defter Otomasyon',
    html:
      `<p>Sayin <strong>${firma}</strong>,</p>` +
      '<p>Demo talebiniz alinmistir. Indirme linki:</p>' +
      `<p><a href="${data.demoUrl}">${data.demoUrl}</a></p>` +
      '<p><strong>Kurulum videosu:</strong> ' +
      '<a href="https://www.youtube.com/watch?v=sGD8BrVTwI8">Izle</a><br>' +
      '<strong>Cihaz kimligi nasil alinir:</strong> ' +
      '<a href="https://www.youtube.com/watch?v=Bcc4_BaMpOc">Izle</a></p>' +
      '<p>Herhangi bir sorunuz olursa bize yazabilirsiniz.</p>' +
      '<p>Saygilarimizla,<br><strong>E-Defter Otomasyon</strong></p>'
  };
}

function buildAdminMail(data, contactError) {
  const lines = [
    'Yeni demo talebi alindi.',
    '',
    `Musteri/Firma: ${data.company || '-'}`,
    `E-posta: ${data.email || '-'}`,
    `Telefon: ${data.phone || '-'}`,
    `Notlar: ${data.notes || '-'}`,
    `Kaynak: ${data.source || '-'}`,
    `UTM Source: ${data.utmSource || '-'}`,
    `UTM Medium: ${data.utmMedium || '-'}`,
    `UTM Campaign: ${data.utmCampaign || '-'}`,
    `UTM Content: ${data.utmContent || '-'}`,
    `UTM Term: ${data.utmTerm || '-'}`,
    `Referrer: ${data.referrer || '-'}`,
    `Sayfa: ${data.pageUrl || '-'}`,
    contactError ? `Contact kaydi hatasi: ${contactError}` : 'Contact kaydi: OK'
  ];
  return {
    subject: `E-Defter | Yeni Demo Talebi (${data.company || 'Musteri'})`,
    text: lines.join('\n'),
    html:
      '<p>Yeni demo talebi alindi.</p>' +
      `<p><strong>Musteri/Firma:</strong> ${data.company || '-'}</p>` +
      `<p><strong>E-posta:</strong> ${data.email || '-'}</p>` +
      `<p><strong>Telefon:</strong> ${data.phone || '-'}</p>` +
      `<p><strong>Notlar:</strong> ${data.notes || '-'}</p>` +
      `<p><strong>Kaynak:</strong> ${data.source || '-'}</p>` +
      `<p><strong>UTM Source:</strong> ${data.utmSource || '-'}</p>` +
      `<p><strong>UTM Medium:</strong> ${data.utmMedium || '-'}</p>` +
      `<p><strong>UTM Campaign:</strong> ${data.utmCampaign || '-'}</p>` +
      `<p><strong>UTM Content:</strong> ${data.utmContent || '-'}</p>` +
      `<p><strong>UTM Term:</strong> ${data.utmTerm || '-'}</p>` +
      `<p><strong>Referrer:</strong> ${data.referrer || '-'}</p>` +
      `<p><strong>Sayfa:</strong> ${data.pageUrl || '-'}</p>` +
      `<p><strong>Contact kaydi:</strong> ${contactError ? contactError : 'OK'}</p>`
  };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const apiKey = text(env.BREVO_API_KEY);
    const fromEmail = text(env.FROM_EMAIL);
    const fromName = text(env.FROM_NAME || 'E-Defter Otomasyon');
    const adminEmail = text(env.ADMIN_EMAIL);
    const adminName = text(env.ADMIN_NAME || 'E-Defter Otomasyon');
    const thankYouUrl = text(env.THANK_YOU_URL || THANK_YOU_FALLBACK);
    const demoUrl = text(env.DEMO_URL);
    const listId = text(env.LIST_ID);

    if (!apiKey || !fromEmail || !adminEmail || !demoUrl) {
      return new Response('Eksik ortam degiskeni', { status: 500 });
    }

    const form = await request.formData();
    const data = {
      company: text(form.get('company') || form.get('Musteri/Firma')),
      email: text(form.get('email') || form.get('E-posta')),
      phone: text(form.get('phone') || form.get('Telefon numarasi')),
      notes: text(form.get('notes') || form.get('Notlar')),
      source: text(form.get('source')),
      utmSource: text(form.get('utm_source')),
      utmMedium: text(form.get('utm_medium')),
      utmCampaign: text(form.get('utm_campaign')),
      utmContent: text(form.get('utm_content')),
      utmTerm: text(form.get('utm_term')),
      referrer: text(form.get('referrer')),
      pageUrl: text(form.get('page_url')),
      demoUrl
    };

    if (!data.email) {
      return new Response('E-posta alani zorunlu', { status: 400 });
    }

    let contactError = '';
    try {
      const payload = {
        email: data.email,
        attributes: {
          COMPANY: data.company || undefined,
          PHONE: data.phone || undefined,
          NOTES: data.notes || undefined,
          SOURCE: data.source || undefined,
          UTM_SOURCE: data.utmSource || undefined,
          UTM_MEDIUM: data.utmMedium || undefined,
          UTM_CAMPAIGN: data.utmCampaign || undefined,
          UTM_CONTENT: data.utmContent || undefined,
          UTM_TERM: data.utmTerm || undefined,
          REFERRER: data.referrer || undefined,
          PAGE_URL: data.pageUrl || undefined,
          LAST_DEMO_REQUEST: new Date().toISOString()
        },
        updateEnabled: true
      };
      if (listId) {
        payload.listIds = [Number(listId)];
      }
      await createOrUpdateContact(apiKey, payload);
    } catch (err) {
      contactError = String(err && err.message ? err.message : err);
    }

    const customerMail = buildCustomerMail(data);
    const adminMail = buildAdminMail(data, contactError);

    await sendEmail(apiKey, {
      sender: { email: fromEmail, name: fromName },
      to: [{ email: data.email, name: data.company || data.email }],
      subject: customerMail.subject,
      htmlContent: customerMail.html,
      textContent: customerMail.text
    });

    await sendEmail(apiKey, {
      sender: { email: fromEmail, name: fromName },
      to: [{ email: adminEmail, name: adminName }],
      replyTo: { email: data.email, name: data.company || data.email },
      subject: adminMail.subject,
      htmlContent: adminMail.html,
      textContent: adminMail.text
    });

    return Response.redirect(thankYouUrl, 303);
  }
};
