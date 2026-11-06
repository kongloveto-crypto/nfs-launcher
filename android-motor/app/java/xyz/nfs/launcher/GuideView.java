package xyz.nfs.launcher;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Guia passo a passo do celular, feito com componentes do próprio Android (só texto e botões): bem mais leve que
 * uma página. O conteúdo vem de assets/guides.json, exportado do mesmo tips.js do app de PC (scripts/export-guides.js).
 * - Caixa compacta: ~1/6 da tela (`size()`). O texto do passo ROLA; os botões ficam sempre visíveis embaixo.
 * - A−/A+ mudam a ESCALA de tudo (caixa, barra, ícones, botões e letra), não só a letra.
 * - A fileira de cima mostra TODOS os guias (Tuning AE86 e Glitches): dá para ir direto a um glitch e voltar às peças.
 * - "Feito"/"Próximo" só liberam depois de rolar 90% do passo.
 * Mesmo comportamento do guia do PC: trocar de guia recomeça, o mesmo guia continua de onde parou, no fim um botão
 * leva ao próximo guia.
 */
@SuppressLint("ViewConstructor")
final class GuideView extends LinearLayout {

    /** Quem mostra o guia: a tela do app ou a janela por cima do jogo (bolha). */
    interface Host {
        void dragBy(float dx, float dy);
        void closeGuide();
        void resize(int w, int h);
    }

    static final float SCALE_DEF = 1f, SCALE_MIN = 0.7f, SCALE_MAX = 1.8f;
    static float scale(Context c) {
        return c.getSharedPreferences("nfs", Context.MODE_PRIVATE).getFloat("guideScale", SCALE_DEF);
    }

    /** Tamanho da caixa em pixels: ~1/6 da área da tela na escala 1; cresce/diminui junto com A+/A−. */
    static int[] size(Context c) {
        DisplayMetrics m = c.getResources().getDisplayMetrics();
        float d = m.density, sw = m.widthPixels, sh = m.heightPixels, s = scale(c);
        float w = Math.min(Math.max(sw * 0.42f * s, 240 * d * s), Math.min(380 * d * s, sw * 0.95f));
        float h = Math.min(Math.max(sw * sh / 6f * s * s / w, 140 * d * s), sh * 0.9f);
        return new int[]{(int) w, (int) h};
    }

    /** Posição que mantém a caixa inteira na tela (como no PC, ela nunca sai da área do jogo). */
    static int inside(int pos, int size, int screen) { return Math.max(0, Math.min(screen - size, pos)); }

    private static JSONObject data;
    private static final float READ = 0.9f; // quanto do passo precisa ter passado na tela para liberar "Feito"
    private final Host host;
    private final SharedPreferences prefs;
    private final float dp;
    private float s;               // escala da caixa (A−/A+)
    private JSONObject L;          // textos e guias no idioma atual
    private JSONObject guide;
    private JSONArray steps;
    private int cur;
    private boolean read;          // o passo atual já foi lido até o fim (90%)

    private TextView title, meta, text, prev, done, next;
    private LinearLayout picker, barTrack;
    private HorizontalScrollView pickerScroll;
    private ScrollView scroll;
    private View barFill;

    static JSONObject data(Context c) {
        if (data == null) {
            try {
                data = new JSONObject(MainActivity.readAsset(c, "guides.json"));
            } catch (Exception e) { data = new JSONObject(); }
        }
        return data;
    }

    GuideView(Context c, Host host, String guideId) {
        super(c);
        this.host = host;
        this.prefs = c.getSharedPreferences("nfs", Context.MODE_PRIVATE);
        this.dp = c.getResources().getDisplayMetrics().density;
        this.s = scale(c);
        setOrientation(VERTICAL);
        setAlpha(prefs.getFloat("op_guide", 0.9f));
        String lang = prefs.getString("lang", "pt");
        L = data(c).optJSONObject(lang);
        if (L == null) L = data(c).optJSONObject("pt");
        build();
        String last = prefs.getString("guide:last", null);
        select(guideId != null ? guideId : (last != null ? last : "t1"), guideId == null || guideId.equals(last));
    }

    private float px(float v) { return v * dp * s; }      // medida na escala atual
    private float sp(float v) { return v * s; }           // letra na escala atual

    /** Monta a caixa inteira na escala atual (chamado de novo a cada A−/A+). */
    private void build() {
        removeAllViews();
        Context c = getContext();
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#F206111F"));
        bg.setStroke((int) Math.max(1, px(1.5f)), Color.parseColor("#2A8CFF"));
        bg.setCornerRadius(px(6));
        setBackground(bg);

        // Barra de título (arrasta a janela): [ TÍTULO ]  A−  A+  ◐  ✕
        LinearLayout head = new LinearLayout(c);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding((int) px(8), 0, 0, 0);
        title = label(9.5f, "#DFF4FF", true);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        head.addView(title, new LayoutParams(0, (int) px(24), 1));
        head.addView(cap("A−", v -> rescale(-0.1f)));
        head.addView(cap("A+", v -> rescale(0.1f)));
        head.addView(cap("◐", v -> cycleOpacity()));
        head.addView(cap("✕", v -> host.closeGuide()));
        dragHandle(head);
        addView(head);
        View line = new View(c);
        line.setBackgroundColor(Color.parseColor("#595AD1FF"));
        addView(line, new LayoutParams(LayoutParams.MATCH_PARENT, Math.max(1, (int) dp)));

        // Todos os guias numa fileira que rola para o lado: AE86 (peças, circuito, arrancada) e Glitches.
        pickerScroll = new HorizontalScrollView(c);
        pickerScroll.setHorizontalScrollBarEnabled(false);
        picker = new LinearLayout(c);
        picker.setGravity(Gravity.CENTER_VERTICAL);
        picker.setPadding((int) px(6), (int) px(3), (int) px(6), 0);
        pickerScroll.addView(picker);
        addView(pickerScroll);

        // "PARTE  3/14" + barra de progresso.
        meta = label(8, "#7FA6C9", true);
        meta.setLetterSpacing(0.1f);
        meta.setSingleLine(true);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        meta.setPadding((int) px(9), (int) px(3), (int) px(9), 0);
        addView(meta);
        barTrack = new LinearLayout(c);
        barTrack.setBackgroundColor(Color.parseColor("#265AD1FF"));
        barFill = new View(c);
        barFill.setBackgroundColor(Color.parseColor("#5AD1FF"));
        barTrack.addView(barFill, new LayoutParams(0, (int) Math.max(1, px(2))));
        LayoutParams tl = new LayoutParams(LayoutParams.MATCH_PARENT, (int) Math.max(1, px(2)));
        tl.setMargins((int) px(9), (int) px(2), (int) px(9), (int) px(3));
        addView(barTrack, tl);

        // Texto do passo: ocupa o que sobra e rola.
        scroll = new ScrollView(c);
        scroll.setScrollbarFadingEnabled(false);
        text = label(11, "#F2FAFF", false);
        text.setLineSpacing(0, 1.18f);
        text.setPadding((int) px(9), 0, (int) px(9), (int) px(3));
        scroll.addView(text);
        scroll.setOnScrollChangeListener((v, x, y, ox, oy) -> checkRead());
        addView(scroll, new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1));

        // Botões: sempre visíveis embaixo.
        LinearLayout actions = new LinearLayout(c);
        actions.setPadding((int) px(6), (int) px(3), (int) px(6), (int) px(6));
        prev = button(false, v -> back());
        done = button(true, v -> { if (read) forward(); });
        next = button(true, v -> { if (read) goNext(); });
        actions.addView(prev, new LayoutParams(LayoutParams.WRAP_CONTENT, (int) px(28)));
        LayoutParams dl = new LayoutParams(0, (int) px(28), 1);
        dl.setMarginStart((int) px(5));
        actions.addView(done, dl);
        LayoutParams nl = new LayoutParams(0, (int) px(28), 1);
        nl.setMarginStart((int) px(5));
        actions.addView(next, nl);
        addView(actions);
    }

    /** A−/A+: muda a escala de tudo e o tamanho da caixa junto. */
    private void rescale(float d) {
        float ns = Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, s + d)) * 10) / 10f;
        if (ns == s) return;
        s = ns;
        prefs.edit().putFloat("guideScale", s).apply();
        build();
        render();
        int[] wh = size(getContext());
        host.resize(wh[0], wh[1]);
    }

    // ── Conteúdo ──
    private JSONArray guides() { return L == null ? new JSONArray() : L.optJSONArray("guides"); }
    private JSONObject find(String id) {
        JSONArray g = guides();
        for (int i = 0; i < g.length(); i++) if (id.equals(g.optJSONObject(i).optString("id"))) return g.optJSONObject(i);
        return g.length() > 0 ? g.optJSONObject(0) : new JSONObject();
    }
    private String ui(String k) { return L == null ? k : L.optJSONObject("ui").optString(k, k); }

    /** Trocar de guia recomeça do passo 1; reabrir o mesmo guia continua de onde parou. */
    private void select(String id, boolean keepProgress) {
        guide = find(id);
        steps = guide.optJSONArray("steps");
        if (steps == null) steps = new JSONArray();
        int saved = prefs.getInt("guide:" + guide.optString("id"), 0);
        cur = keepProgress ? Math.max(0, Math.min(steps.length(), saved)) : 0;
        save();
        render();
    }
    private void save() {
        prefs.edit().putInt("guide:" + guide.optString("id"), cur).putString("guide:last", guide.optString("id")).apply();
    }

    private void render() {
        title.setText("[ " + guide.optString("title").toUpperCase() + " ]");
        renderPicker();
        int numbered = 0, doneNumbered = 0;
        for (int i = 0; i < steps.length(); i++) if (!steps.optJSONObject(i).optBoolean("note")) { numbered++; if (i < cur) doneNumbered++; }
        boolean end = cur >= steps.length();
        prev.setText(ui("prev"));
        {
            JSONObject st = end ? null : steps.optJSONObject(cur);
            boolean note = st != null && st.optBoolean("note");
            String count = end ? numbered + "/" + numbered : note ? ui("attention") : (doneNumbered + 1) + "/" + numbered;
            meta.setText((end ? ui("finished") : st.optString("part")).toUpperCase() + "   " + count);
            text.setText(end ? guide.optString("end") : st.optString("text"));
            text.setTextColor(Color.parseColor(note ? "#FFF1CC" : "#F2FAFF"));
            setProgress(steps.length() == 0 ? 0 : (float) cur / steps.length());
            enable(prev, cur > 0);
            done.setVisibility(VISIBLE);
            done.setTag(end ? ui("restart") : note ? ui("gotIt") : ui("done"));
            String nx = guide.optString("next", "");
            boolean hasNext = end && !nx.isEmpty() && !"null".equals(nx);
            next.setVisibility(hasNext ? VISIBLE : GONE);
            if (hasNext) next.setTag(guide.optString("nextLabel"));
        }
        // Passo novo começa do topo e precisa ser lido de novo.
        read = false;
        scroll.scrollTo(0, 0);
        scroll.post(this::checkRead);
    }

    /** Fileira com todos os guias, agrupados: "AE86 · Peças Circuito Arrancada | Glitches · 1 barra 2 barras 3 barras". */
    private void renderPicker() {
        picker.removeAllViews();
        JSONObject groups = L == null ? new JSONObject() : L.optJSONObject("groups");
        JSONArray g = guides();
        String lastGroup = null;
        View onChip = null;
        for (int i = 0; i < g.length(); i++) {
            JSONObject o = g.optJSONObject(i);
            String grp = o.optString("group");
            if (!grp.equals(lastGroup)) {
                TextView h = label(8, "#7FA6C9", true);
                h.setText((groups != null ? groups.optString(grp, grp) : grp).toUpperCase());
                h.setPadding(lastGroup == null ? 0 : (int) px(8), 0, (int) px(5), 0);
                picker.addView(h);
                lastGroup = grp;
            }
            boolean on = o.optString("id").equals(guide.optString("id"));
            TextView b = chip(o.optString("short"), on);
            b.setOnClickListener(v -> { if (!on) select(o.optString("id"), false); });
            picker.addView(b);
            if (on) onChip = b;
        }
        View target = onChip;
        if (target != null) pickerScroll.post(() -> pickerScroll.smoothScrollTo(Math.max(0, target.getLeft() - (int) px(40)), 0));
    }

    /** Libera "Feito"/"Próximo" quando 90% do texto do passo já passou pela tela (ou se ele cabe inteiro). */
    private void checkRead() {
        int content = text.getHeight(), view = scroll.getHeight();
        boolean fits = content <= view + 2;
        if (!read) read = fits || (scroll.getScrollY() + view) >= content * READ;
        String hint = "en".equals(prefs.getString("lang", "pt")) ? "▼ scroll" : "▼ role";
        for (TextView b : new TextView[]{done, next}) {
            Object label = b.getTag();
            b.setText(read || label == null ? (label == null ? "" : label.toString()) : hint);
            enable(b, read);
        }
    }

    private void setProgress(float f) {
        barTrack.post(() -> {
            LayoutParams lp = (LayoutParams) barFill.getLayoutParams();
            lp.width = (int) (barTrack.getWidth() * Math.max(0, Math.min(1, f)));
            barFill.setLayoutParams(lp);
        });
    }

    private void forward() { cur = cur >= steps.length() ? 0 : cur + 1; save(); render(); }
    private void back() {
        if (cur > 0) { cur--; save(); render(); }
    }
    private void goNext() {
        select(guide.optString("next"), false);
    }
    private void cycleOpacity() {
        float[] steps = {1f, 0.9f, 0.75f, 0.6f};
        float a = getAlpha(), nextA = steps[0];
        for (int i = 0; i < steps.length; i++) if (Math.abs(a - steps[i]) < 0.03f) { nextA = steps[(i + 1) % steps.length]; break; }
        setAlpha(nextA);
        prefs.edit().putFloat("op_guide", nextA).apply();
    }

    // ── Peças visuais (estilo "janela de sistema" do PC), todas na escala atual ──
    private void enable(TextView b, boolean on) { b.setEnabled(on); b.setAlpha(on ? 1f : 0.35f); }
    private TextView label(float size, String color, boolean bold) {
        TextView t = new TextView(getContext());
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp(size));
        t.setTextColor(Color.parseColor(color));
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setIncludeFontPadding(false);
        return t;
    }
    private TextView cap(String str, OnClickListener l) {
        TextView t = label(11, "#5AD1FF", true);
        t.setText(str);
        t.setGravity(Gravity.CENTER);
        t.setOnClickListener(l);
        t.setLayoutParams(new LayoutParams((int) px(28), (int) px(24)));
        return t;
    }
    private TextView chip(String str, boolean on) {
        TextView t = label(9, on ? "#FFFFFF" : "#BFD8EE", on);
        t.setText(str);
        t.setPadding((int) px(7), (int) px(3), (int) px(7), (int) px(3));
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.parseColor(on ? "#8C2A8CFF" : "#CC0A1E37"));
        d.setStroke(Math.max(1, (int) dp), Color.parseColor(on ? "#5AD1FF" : "#735AD1FF"));
        d.setCornerRadius(px(3));
        t.setBackground(d);
        LayoutParams lp = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        lp.setMarginEnd((int) px(4));
        t.setLayoutParams(lp);
        return t;
    }
    private TextView button(boolean accent, OnClickListener l) {
        TextView t = label(10.5f, accent ? "#FFFFFF" : "#E8F6FF", accent);
        t.setGravity(Gravity.CENTER);
        t.setPadding((int) px(10), 0, (int) px(10), 0);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.END);
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.parseColor(accent ? "#B32A8CFF" : "#CC0A1E37"));
        d.setStroke(Math.max(1, (int) dp), Color.parseColor(accent ? "#5AD1FF" : "#735AD1FF"));
        d.setCornerRadius(px(3));
        t.setBackground(d);
        t.setOnClickListener(l);
        return t;
    }
    @SuppressLint("ClickableViewAccessibility")
    private void dragHandle(View v) {
        final float[] last = new float[2];
        v.setOnTouchListener((view, e) -> {
            if (e.getActionMasked() == MotionEvent.ACTION_DOWN) { last[0] = e.getRawX(); last[1] = e.getRawY(); return true; }
            if (e.getActionMasked() == MotionEvent.ACTION_MOVE) {
                host.dragBy(e.getRawX() - last[0], e.getRawY() - last[1]);
                last[0] = e.getRawX(); last[1] = e.getRawY();
            }
            return true;
        });
    }
}
