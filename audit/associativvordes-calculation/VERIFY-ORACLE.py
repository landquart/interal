# Independent expected values; no imports from the application.
from decimal import Decimal as D, getcontext
getcontext().prec = 45
A = min(D(80),D('.45')*80+D('.35')*60+D('.20')*(100-20))
P = D(100)*(A/100)**D('.65')*(D(64)/100)**D('.35')
N = [1493000000,133000000,334000000,561000000,66000000,210000000]
Ps = list(map(D,['74.87','48.66','35.24','56.71','94.08','52.64']))
print('A=',A,'P=',P)
print('FA=',sum(D(n)*p for n,p in zip(N,Ps))/sum(N),'Abar=85','N=',sum(N))
print('3-language boundary coverage=',D(sum(N[:3]))/sum(N))
