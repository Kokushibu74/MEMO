package com.shihab.memo20

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private var isPolling = false
    private var lastPairingCode = ""
    private val seenIds = HashSet<String>()

    private lateinit var statusBadge: TextView
    private lateinit var idInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var codeView: TextView
    private lateinit var qrImage: ImageView
    private lateinit var copyOpenBtn: Button
    private lateinit var chatLogView: TextView
    private lateinit var toPhoneInput: EditText
    private lateinit var msgInput: EditText
    private lateinit var autoSwitch: Switch
    private lateinit var autoTextInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("memo_wa_native", Context.MODE_PRIVATE)

        val rootScroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#0B141A"))
            isFillViewport = true
        }
        val mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 48)
        }

        // Header
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 24)
        }
        val title = TextView(this).apply {
            text = "MEMO 2.0 (Native WA)"
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#00A884"))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        statusBadge = TextView(this).apply {
            text = "বিচ্ছিন্ন"
            textSize = 12f
            setTextColor(Color.parseColor("#F87171"))
            setPadding(24, 10, 24, 10)
            background = roundedBg("#3B1D1D", 30f)
        }
        header.addView(title)
        header.addView(statusBadge)
        mainLayout.addView(header)

        // Card 1: API & Session Connection
        val sessionCard = createCard()
        sessionCard.addView(sectionTitle("১. Green-API ও ইন-অ্যাপ সেশন সেটআপ"))

        idInput = createInput("Instance ID (যেমন: 7103XXXXXX)", prefs.getString("id", "") ?: "")
        tokenInput = createInput("API Token Instance", prefs.getString("token", "") ?: "")
        phoneInput = createInput("আপনার WhatsApp নম্বর (8801XXXXXXXXX)", prefs.getString("phone", "") ?: "", InputType.TYPE_CLASS_PHONE)

        sessionCard.addView(idInput)
        sessionCard.addView(tokenInput)
        sessionCard.addView(phoneInput)

        val btnRow1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val pairBtn = createButton("লিংক কোড (Pairing)", "#00A884", "#000000").apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = 8 }
            setOnClickListener { savePrefs(); requestPairingCode() }
        }
        val qrBtn = createButton("QR কোড আনুন", "#2A3942", "#E9EDEF").apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = 8 }
            setOnClickListener { savePrefs(); requestQrCode() }
        }
        btnRow1.addView(pairBtn)
        btnRow1.addView(qrBtn)
        sessionCard.addView(btnRow1)

        val checkBtn = createButton("সেশন সেভ ও কানেক্ট করুন", "#1F2C34", "#34D399").apply {
            setOnClickListener { savePrefs(); checkStatusAndStartPolling() }
        }
        sessionCard.addView(checkBtn)

        codeView = TextView(this).apply {
            textSize = 24f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#34D399"))
            gravity = Gravity.CENTER
            setPadding(16, 24, 16, 16)
            visibility = View.GONE
        }
        qrImage = ImageView(this).apply {
            visibility = View.GONE
            setPadding(16, 16, 16, 16)
        }
        copyOpenBtn = createButton("কোড কপি করে সরাসরি WhatsApp খুলুন", "#005C4B", "#FFFFFF").apply {
            visibility = View.GONE
            setOnClickListener { copyCodeAndLaunchWhatsApp() }
        }

        sessionCard.addView(codeView)
        sessionCard.addView(qrImage)
        sessionCard.addView(copyOpenBtn)
        mainLayout.addView(sessionCard)

        // Card 2: Live Inbox & Send Message
        val chatCard = createCard()
        chatCard.addView(sectionTitle("২. রিয়েল-টাইম মেসেজ গ্রহণ ও প্রদান"))

        chatLogView = TextView(this).apply {
            text = "সেশন কানেক্ট হলে এখানে রিয়েল-টাইম মেসেজ দেখা যাবে...\n"
            textSize = 13f
            setTextColor(Color.parseColor("#E9EDEF"))
            setPadding(20, 20, 20, 20)
            background = roundedBg("#080E12", 16f)
            minLines = 7
        }
        chatCard.addView(chatLogView)

        toPhoneInput = createInput("প্রাপকের নম্বর (8801XXXXXXXXX)", "", InputType.TYPE_CLASS_PHONE)
        msgInput = createInput("আপনার মেসেজ লিখুন...", "")
        val sendBtn = createButton("মেসেজ পাঠান (Send Message)", "#00A884", "#000000").apply {
            setOnClickListener {
                val to = toPhoneInput.text.toString().replace(Regex("[^0-9]"), "")
                val txt = msgInput.text.toString().trim()
                if (to.isEmpty() || txt.isEmpty()) {
                    toast("প্রাপকের নম্বর ও মেসেজ দিন")
                } else {
                    sendWhatsAppMessage(to, txt, false)
                    msgInput.setText("")
                }
            }
        }
        chatCard.addView(toPhoneInput)
        chatCard.addView(msgInput)
        chatCard.addView(sendBtn)
        mainLayout.addView(chatCard)

        // Card 3: Auto Reply
        val autoCard = createCard()
        autoCard.addView(sectionTitle("৩. অটো-রিপ্লাই (Auto-Responder)"))
        autoSwitch = Switch(this).apply {
            text = "ইনকামিং মেসেজে অটো-রিপ্লাই চালু রাখুন"
            setTextColor(Color.parseColor("#E9EDEF"))
            isChecked = prefs.getBoolean("autoReply", false)
            setOnCheckedChangeListener { _, _ -> savePrefs() }
        }
        autoTextInput = createInput("অটো-রিপ্লাই মেসেজ", prefs.getString("autoText", "ধন্যবাদ! আপনার মেসেজ পেয়েছি, শীঘ্রই উত্তর দেওয়া হবে।") ?: "")
        autoCard.addView(autoSwitch)
        autoCard.addView(autoTextInput)
        mainLayout.addView(autoCard)

        rootScroll.addView(mainLayout)
        setContentView(rootScroll)

        if (idInput.text.isNotEmpty() && tokenInput.text.isNotEmpty()) {
            checkStatusAndStartPolling()
        }
    }

    private fun savePrefs() {
        getSharedPreferences("memo_wa_native", Context.MODE_PRIVATE).edit()
            .putString("id", idInput.text.toString().trim())
            .putString("token", tokenInput.text.toString().trim())
            .putString("phone", phoneInput.text.toString().replace(Regex("[^0-9]"), ""))
            .putBoolean("autoReply", autoSwitch.isChecked)
            .putString("autoText", autoTextInput.text.toString())
            .apply()
    }

    private fun apiCall(method: String, endpoint: String, body: JSONObject? = null, extraPath: String = ""): JSONObject? {
        val id = idInput.text.toString().trim()
        val token = tokenInput.text.toString().trim()
        if (id.isEmpty() || token.isEmpty()) return null
        val urlStr = "https://api.green-api.com/waInstance$id/$endpoint/$token$extraPath"
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("Content-Type", "application/json")
        }
        if (body != null) {
            conn.doOutput = true
            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
        }
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        val respText = stream?.bufferedReader()?.use { it.readText() } ?: return null
        return if (respText.trim().startsWith("{")) JSONObject(respText) else null
    }

    private fun requestPairingCode() {
        val phone = phoneInput.text.toString().replace(Regex("[^0-9]"), "")
        if (phone.length < 10) {
            toast("কান্ট্রি কোডসহ সঠিক নম্বর দিন (যেমন: 88017XXXXXXXX)")
            return
        }
        qrImage.visibility = View.GONE
        codeView.visibility = View.VISIBLE
        codeView.text = "কোড তৈরি হচ্ছে..."
        thread {
            try {
                val req = JSONObject().put("phoneNumber", phone.toLong())
                val res = apiCall("POST", "getAuthorizationCode", req)
                val code = res?.optString("code", "") ?: ""
                handler.post {
                    if (code.isNotEmpty()) {
                        lastPairingCode = code
                        codeView.text = "কোড: $code"
                        copyOpenBtn.visibility = View.VISIBLE
                        checkStatusAndStartPolling()
                    } else {
                        codeView.text = "ত্রুটি: Instance ID/Token চেক করুন"
                    }
                }
            } catch (e: Exception) {
                handler.post { codeView.text = "ত্রুটি: ${e.message}" }
            }
        }
    }

    private fun requestQrCode() {
        codeView.visibility = View.VISIBLE
        codeView.text = "QR কোড লোড হচ্ছে..."
        qrImage.visibility = View.GONE
        thread {
            try {
                val res = apiCall("GET", "qr")
                val type = res?.optString("type", "") ?: ""
                val msg = res?.optString("message", "") ?: ""
                handler.post {
                    if (type == "qrCode" && msg.isNotEmpty()) {
                        val bytes = Base64.decode(msg, Base64.DEFAULT)
                        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        qrImage.setImageBitmap(bmp)
                        qrImage.visibility = View.VISIBLE
                        codeView.text = "WhatsApp Linked Devices দিয়ে স্ক্যান করুন:"
                        checkStatusAndStartPolling()
                    } else {
                        codeView.text = if (type == "alreadyLogged") "সেশন ইতিমধ্যে সংযুক্ত!" else "QR প্রস্তুত নয়, আবার চেষ্টা করুন"
                    }
                }
            } catch (e: Exception) {
                handler.post { codeView.text = "QR ত্রুটি: ${e.message}" }
            }
        }
    }

    private fun copyCodeAndLaunchWhatsApp() {
        if (lastPairingCode.isNotEmpty()) {
            val cb = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cb.setPrimaryClip(ClipData.newPlainText("WA_CODE", lastPairingCode))
            toast("কোড কপি হয়েছে: $lastPairingCode")
        }
        try {
            val intent = packageManager.getLaunchIntentForPackage("com.whatsapp")
                ?: packageManager.getLaunchIntentForPackage("com.whatsapp.w4b")
                ?: Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://"))
            startActivity(intent)
        } catch (e: Exception) {
            toast("WhatsApp অ্যাপ পাওয়া যায়নি")
        }
    }

    private fun checkStatusAndStartPolling() {
        thread {
            try {
                val res = apiCall("GET", "getStateInstance")
                val state = res?.optString("stateInstance", "notAuthorized") ?: "offline"
                val connected = state == "authorized"
                handler.post { updateStatusUI(connected, state) }
            } catch (_: Exception) {}
        }
        if (!isPolling) {
            isPolling = true
            startNotificationLoop()
        }
    }

    private fun startNotificationLoop() {
        thread {
            while (isPolling) {
                try {
                    val stateRes = apiCall("GET", "getStateInstance")
                    val state = stateRes?.optString("stateInstance", "") ?: ""
                    val isAuth = state == "authorized"
                    handler.post { updateStatusUI(isAuth, state) }

                    val notif = apiCall("GET", "receiveNotification")
                    if (notif != null && notif.has("receiptId")) {
                        val receiptId = notif.getInt("receiptId")
                        val body = notif.optJSONObject("body")
                        val webhookType = body?.optString("typeWebhook", "") ?: ""

                        if (webhookType == "incomingMessageReceived") {
                            val msgId = body?.optString("idMessage", "") ?: UUID.randomUUID().toString()
                            val sender = body?.optJSONObject("senderData")?.optString("sender", "")
                                ?.replace("@c.us", "") ?: "Unknown"
                            val msgData = body?.optJSONObject("messageData")
                            val text = msgData?.optJSONObject("textMessageData")?.optString("textMessage", "")
                                ?: msgData?.optJSONObject("extendedTextMessageData")?.optString("text", "")
                                ?: ""

                            if (text.isNotEmpty() && !seenIds.contains(msgId)) {
                                seenIds.add(msgId)
                                handler.post {
                                    appendChat("প্রেরক ($sender)", text)
                                    if (toPhoneInput.text.isEmpty()) toPhoneInput.setText(sender)
                                    if (autoSwitch.isChecked) {
                                        val reply = autoTextInput.text.toString().trim()
                                        if (reply.isNotEmpty()) sendWhatsAppMessage(sender, reply, true)
                                    }
                                }
                            }
                        }
                        apiCall("DELETE", "deleteNotification", null, "/$receiptId")
                    }
                } catch (_: Exception) {}
                Thread.sleep(3000)
            }
        }
    }

    private fun sendWhatsAppMessage(phone: String, message: String, isAuto: Boolean) {
        thread {
            try {
                val payload = JSONObject()
                    .put("chatId", "${phone.replace(Regex("[^0-9]"), "")}@c.us")
                    .put("message", message)
                val res = apiCall("POST", "sendMessage", payload)
                val sent = res?.has("idMessage") == true
                handler.post {
                    if (sent) {
                        appendChat(if (isAuto) "অটো-রিপ্লাই -> $phone" else "আমি -> $phone", message)
                    } else if (!isAuto) {
                        toast("মেসেজ যায়নি! সেশন সংযুক্ত কিনা দেখুন।")
                    }
                }
            } catch (e: Exception) {
                handler.post { if (!isAuto) toast("ত্রুটি: ${e.message}") }
            }
        }
    }

    private fun updateStatusUI(connected: Boolean, rawState: String) {
        if (connected) {
            statusBadge.text = "সংযুক্ত (Active)"
            statusBadge.setTextColor(Color.parseColor("#34D399"))
            statusBadge.background = roundedBg("#064E3B", 30f)
            codeView.visibility = View.GONE
            qrImage.visibility = View.GONE
            copyOpenBtn.visibility = View.GONE
        } else {
            statusBadge.text = if (rawState.isNotEmpty()) "বিচ্ছিন্ন ($rawState)" else "বিচ্ছিন্ন"
            statusBadge.setTextColor(Color.parseColor("#F87171"))
            statusBadge.background = roundedBg("#3B1D1D", 30f)
        }
    }

    private fun appendChat(who: String, text: String) {
        val time = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date())
        val current = chatLogView.text.toString()
        val cleanCurrent = if (current.startsWith("সেশন কানেক্ট হলে")) "" else current
        chatLogView.text = "[$time] $who:\n$text\n─────────────────\n$cleanCurrent"
    }

    private fun createCard(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(32, 32, 32, 32)
        background = roundedBg("#111B21", 24f)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = 28
        }
    }

    private fun sectionTitle(txt: String): TextView = TextView(this).apply {
        text = txt
        textSize = 15f
        setTypeface(null, Typeface.BOLD)
        setTextColor(Color.parseColor("#00A884"))
        setPadding(0, 0, 0, 16)
    }

    private fun createInput(hintText: String, initial: String, type: Int = InputType.TYPE_CLASS_TEXT): EditText = EditText(this).apply {
        hint = hintText
        setText(initial)
        inputType = type
        textSize = 14f
        setTextColor(Color.parseColor("#E9EDEF"))
        setHintTextColor(Color.parseColor("#8696A0"))
        setPadding(28, 24, 28, 24)
        background = roundedBg("#202C33", 16f)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = 20
        }
    }

    private fun createButton(txt: String, bgHex: String, fgHex: String): Button = Button(this).apply {
        text = txt
        textSize = 13f
        isAllCaps = false
        setTypeface(null, Typeface.BOLD)
        setTextColor(Color.parseColor(fgHex))
        background = roundedBg(bgHex, 16f)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = 10
            bottomMargin = 10
        }
    }

    private fun roundedBg(hex: String, radius: Float): GradientDrawable = GradientDrawable().apply {
        setColor(Color.parseColor(hex))
        cornerRadius = radius
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        isPolling = false
        super.onDestroy()
    }
}
