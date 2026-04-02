const THANK_YOU_FALLBACK = 'https://edefterotomasyon.com.tr/purchase-thanks.html';

function text(value) {
  return String(value || '').trim();
}

async function toBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

function buildCustomerMail(data) {
  const firma = data.company || 'degerli musteri';
  return {
    subject: 'E-Defter Otomasyon | Satin Alma Talebiniz Alindi',
    text:
      `Sayin ${firma},\n\n` +
      'Satin alma talebiniz alinmistir. Odeme bilgileri asagidadir:\n\n' +
      `Alici: ${data.paymentName}\n` +
      `IBAN: ${data.paymentIban}\n\n` +
      'Lutfen odeme aciklama kismina Ad Soyad veya Firma Unvani yaziniz.\n' +
      'Odeme sonrasi bu e-postayi yanitlayarak veya satis@edefterotomasyon.com.tr adresine dekont iletebilirsiniz.\n' +
      'Odeme onayi sonrasinda full kurulum linki ve cihaz kimligi adimlari tarafiniza iletilecektir.\n\n' +
      'Saygilarimizla,\nE-Defter Otomasyon',
    html:
      `<p>Sayin <strong>${firma}</strong>,</p>` +
      '<p>Satin alma talebiniz alinmistir. Odeme bilgileri asagidadir:</p>' +
      `<p><strong>Alici:</strong> ${data.paymentName}<br>` +
      `<strong>IBAN:</strong> ${data.paymentIban}</p>` +
      '<p><strong>Not:</strong> Lutfen odeme aciklama kismina <strong>Ad Soyad</strong> veya <strong>Firma Unvani</strong> yaziniz.</p>' +
      '<p>Odeme sonrasi bu e-postayi yanitlayarak veya <strong>satis@edefterotomasyon.com.tr</strong> adresine dekont paylasabilirsiniz.<br>' +
      'Odeme onayi sonrasinda full kurulum linki ve cihaz kimligi adimlari tarafiniza iletilecektir.</p>' +
      '<p>Saygilarimizla,<br><strong>E-Defter Otomasyon</strong></p>'
  };
}

function buildAdminMail(data, attachmentInfo) {
  const lines = [
    'Yeni satin alma talebi alindi.',
    '',
    `Musteri/Firma: ${data.company || '-'}`,
    `E-posta: ${data.email || '-'}`,
    `Telefon: ${data.phone || '-'}`,
    `Cihaz Kimligi: ${data.deviceId || '-'}`,
    `Notlar: ${data.notes || '-'}`,
    attachmentInfo ? `Dekont: ${attachmentInfo}` : 'Dekont: -'
  ];
  return {
    subject: `E-Defter | Yeni Satin Alma Talebi (${data.company || 'Musteri'})`,
    text: lines.join('\n'),
    html:
      '<p>Yeni satin alma talebi alindi.</p>' +
      `<p><strong>Musteri/Firma:</strong> ${data.company || '-'}</p>` +
      `<p><strong>E-posta:</strong> ${data.email || '-'}</p>` +
      `<p><strong>Telefon:</strong> ${data.phone || '-'}</p>` +
      `<p><strong>Cihaz Kimligi:</strong> ${data.deviceId || '-'}</p>` +
      `<p><strong>Notlar:</strong> ${data.notes || '-'}</p>` +
      `<p><strong>Dekont:</strong> ${attachmentInfo || '-'}</p>`
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
    const paymentName = text(env.PAYMENT_NAME || 'Yavuz Mercimek');
    const paymentIban = text(env.PAYMENT_IBAN || 'TR95 0020 5000 0101 8288 4000 08');

    if (!apiKey || !fromEmail || !adminEmail) {
      return new Response('Eksik ortam degiskeni', { status: 500 });
    }

    const form = await request.formData();
    const data = {
      company: text(form.get('Musteri/Firma') || form.get('company')),
      email: text(form.get('email') || form.get('E-posta')),
      phone: text(form.get('Telefon numarasi') || form.get('phone')),
      deviceId: text(form.get('Cihaz Kimligi') || form.get('deviceId')),
      notes: text(form.get('Notlar') || form.get('notes')),
      paymentName,
      paymentIban
    };

    if (!data.email) {
      return new Response('E-posta alani zorunlu', { status: 400 });
    }

    let attachmentInfo = '';
    let attachmentPayload = null;
    const attachment = form.get('attachment');
    if (attachment && typeof attachment === 'object' && attachment.size > 0) {
      if (attachment.size <= 5 * 1024 * 1024) {
        const content = await toBase64(attachment);
        attachmentPayload = [
          {
            name: attachment.name || 'dekont',
            content
          }
        ];
        attachmentInfo = attachment.name || 'Yuklendi';
      } else {
        attachmentInfo = 'Dosya 5MB ustu, mail ekine konmadi';
      }
    }

    const customerMail = buildCustomerMail(data);
    const adminMail = buildAdminMail(data, attachmentInfo);

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
      textContent: adminMail.text,
      attachment: attachmentPayload || undefined
    });

    return Response.redirect(thankYouUrl, 303);
  }
};
