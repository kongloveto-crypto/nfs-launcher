package xyz.nfs.launcher;

import android.annotation.SuppressLint;
import android.app.Service;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.IBinder;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.IOException;
import java.io.InputStream;

/**
 * Bolha por cima do jogo (que roda no motor do próprio app). Parada, é só uma imagem pequena: não desenha nada por quadro.
 * Tocar abre um mini menu: Guia (só jogos com dicas), Reiniciar o jogo e Voltar ao início (esses dois fecham a partida,
 * então pedem um segundo toque). O guia é o GuideView nativo. A bolha, o menu e o guia nunca saem da tela.
 * Toques fora da bolha e das janelas vão direto para o jogo.
 * Precisa da permissão "Sobrepor a outros apps"; sem ela o serviço não abre nada.
 */
public class BubbleService extends Service {
    static final String EXTRA_TIPS = "tips";

    private WindowManager wm;
    private ImageView bubble;
    private WindowManager.LayoutParams bubbleLp;
    private LinearLayout menu;
    private GuideView guide;
    private WindowManager.LayoutParams guideLp;
    private boolean tips;
    private float dp;

    @Override public IBinder onBind(Intent i) { return null; }

    // Avisos da tela do jogo (motor): jogo na frente = bolha aparece; jogo minimizado = bolha some.
    static final String ACTION_SHOW = "xyz.nfs.SHOW", ACTION_HIDE = "xyz.nfs.HIDE";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_SHOW.equals(action) || ACTION_HIDE.equals(action)) {
            if (bubble == null) { stopSelf(); return START_NOT_STICKY; } // bolha desligada/escondida: nada a fazer
            int v = ACTION_SHOW.equals(action) ? View.VISIBLE : View.GONE;
            if (v == View.GONE) hideMenu();
            bubble.setVisibility(v);
            if (guide != null) guide.setVisibility(v);
            return START_NOT_STICKY;
        }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
        wm = getSystemService(WindowManager.class);
        dp = getResources().getDisplayMetrics().density;
        tips = intent != null && intent.getBooleanExtra(EXTRA_TIPS, false);
        if (bubble == null) showBubble();
        return START_NOT_STICKY;
    }

    // Tamanho real da tela agora (deitada), para nada ficar fora dela.
    private int screenW() { return wm.getCurrentWindowMetrics().getBounds().width(); }
    private int screenH() { return wm.getCurrentWindowMetrics().getBounds().height(); }

    private WindowManager.LayoutParams overlay(int w, int h) {
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(w, h,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        return lp;
    }

    @SuppressLint("ClickableViewAccessibility")
    private void showBubble() {
        int size = (int) (48 * dp);
        bubble = new ImageView(this);
        try (InputStream in = getAssets().open(MainActivity.ASSETS + "icon.png")) {
            bubble.setImageBitmap(BitmapFactory.decodeStream(in));
        } catch (IOException e) { bubble.setBackgroundColor(Color.parseColor("#2A8CFF")); }
        bubble.setAlpha(0.8f);
        bubbleLp = overlay(size, size);
        bubbleLp.x = screenW() - size - (int) (6 * dp);
        bubbleLp.y = (int) (screenH() * 0.35f);
        final float[] down = new float[4];
        final boolean[] moved = new boolean[1];
        bubble.setOnTouchListener((v, e) -> {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    down[0] = e.getRawX(); down[1] = e.getRawY(); down[2] = bubbleLp.x; down[3] = bubbleLp.y; moved[0] = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - down[0], dy = e.getRawY() - down[1];
                    if (Math.abs(dx) + Math.abs(dy) > 12 * dp) moved[0] = true;
                    if (moved[0]) {
                        bubbleLp.x = GuideView.inside((int) (down[2] + dx), size, screenW());
                        bubbleLp.y = GuideView.inside((int) (down[3] + dy), size, screenH());
                        wm.updateViewLayout(bubble, bubbleLp);
                        if (menu != null) hideMenu();
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved[0]) toggleMenu();
                    return true;
                default:
                    return true;
            }
        });
        wm.addView(bubble, bubbleLp);
    }

    private String tr(String pt, String en) {
        return "en".equals(getSharedPreferences("nfs", MODE_PRIVATE).getString("lang", "pt")) ? en : pt;
    }

    private void toggleMenu() {
        if (menu != null) { hideMenu(); return; }
        menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#F206111F"));
        bg.setStroke((int) (1.5f * dp), Color.parseColor("#2A8CFF"));
        bg.setCornerRadius(8 * dp);
        menu.setBackground(bg);
        menu.setPadding((int) (4 * dp), (int) (4 * dp), (int) (4 * dp), (int) (4 * dp));
        if (tips) menu.addView(item(tr("Guia", "Guide"), v -> { hideMenu(); toggleGuide(); }));
        menu.addView(confirmItem(tr("Reiniciar o jogo", "Restart the game"), tr("Salvou na garagem? Toque de novo", "Saved in the garage? Tap again"), this::restartGame));
        menu.addView(confirmItem(tr("Voltar ao início", "Back to home"), tr("Salvou na garagem? Toque de novo", "Saved in the garage? Tap again"), this::goHome));
        menu.addView(item(tr("Esconder bolha", "Hide bubble"), v -> stopSelf()));
        WindowManager.LayoutParams lp = overlay(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT);
        menu.measure(View.MeasureSpec.UNSPECIFIED, View.MeasureSpec.UNSPECIFIED);
        int mw = menu.getMeasuredWidth(), mh = menu.getMeasuredHeight();
        boolean right = bubbleLp.x > screenW() / 2;
        lp.x = GuideView.inside(right ? bubbleLp.x - mw - (int) (6 * dp) : bubbleLp.x + (int) (54 * dp), mw, screenW());
        lp.y = GuideView.inside(bubbleLp.y, mh, screenH());
        wm.addView(menu, lp);
    }
    private void hideMenu() { if (menu != null) { wm.removeView(menu); menu = null; } }

    private TextView item(String s, View.OnClickListener l) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextColor(Color.parseColor("#E8F6FF"));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setPadding((int) (14 * dp), (int) (8 * dp), (int) (14 * dp), (int) (8 * dp));
        t.setOnClickListener(l);
        return t;
    }

    // Item que fecha a partida: o primeiro toque só avisa; o segundo faz.
    private TextView confirmItem(String s, String again, Runnable action) {
        final boolean[] armed = new boolean[1];
        return item(s, v -> {
            if (armed[0]) { action.run(); return; }
            armed[0] = true;
            ((TextView) v).setText(again);
            ((TextView) v).setTextColor(Color.parseColor("#FFB020"));
        });
    }

    private void toggleGuide() {
        if (guide != null) { closeGuide(); return; }
        guide = new GuideView(this, new GuideView.Host() {
            @Override public void dragBy(float dx, float dy) {
                guideLp.x = GuideView.inside(guideLp.x + (int) dx, guideLp.width, screenW());
                guideLp.y = GuideView.inside(guideLp.y + (int) dy, guideLp.height, screenH());
                wm.updateViewLayout(guide, guideLp);
            }
            @Override public void closeGuide() { BubbleService.this.closeGuide(); }
            @Override public void resize(int w, int h) { // A+/A−: a caixa acompanha a escala e continua na tela
                if (guide == null) return;
                guideLp.width = w; guideLp.height = h;
                guideLp.x = GuideView.inside(guideLp.x, w, screenW());
                guideLp.y = GuideView.inside(guideLp.y, h, screenH());
                wm.updateViewLayout(guide, guideLp);
            }
        }, null);
        int[] size = GuideView.size(this); // ~1/6 da tela na escala padrão; o texto rola dentro
        guideLp = overlay(size[0], size[1]);
        guideLp.x = (int) (12 * dp);
        guideLp.y = (int) (12 * dp);
        wm.addView(guide, guideLp);
    }
    private void closeGuide() { if (guide != null) { wm.removeView(guide); guide = null; } }

    /** Volta à tela inicial do app (fecha a aba do jogo) e some com a bolha. */
    private void goHome() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("home", true);
        startActivity(i);
        stopSelf();
    }

    /** Fecha a partida e abre o mesmo jogo de novo, passando pela tela inicial do app. */
    private void restartGame() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("restart", true);
        startActivity(i);
        stopSelf();
    }

    /** App tirado da lista de apps abertos: o jogo é encerrado junto (nada fica rodando). */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        MainActivity.closeGame(this, -1);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        hideMenu();
        closeGuide();
        if (bubble != null) { wm.removeView(bubble); bubble = null; }
        super.onDestroy();
    }
}
