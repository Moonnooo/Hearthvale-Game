import nodemailer from 'nodemailer';
export function resetMailer(env=process.env){
  const configured=Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.MAIL_FROM);
  const transport=configured?nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_PORT==='465',requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true}):null;
  return {configured,async send(email,token,origin){if(!transport)throw Error('Email delivery is not configured.');const link=`${origin}/#reset=${token}`;await transport.sendMail({from:env.MAIL_FROM,to:email,subject:'Reset your Hearthvale password',text:`A password reset was requested for your Hearthvale account.\n\nChoose a new password here:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Your password has not changed.`});}};
}
