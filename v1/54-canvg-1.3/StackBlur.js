/* @license 

StackBlur - a fast almost Gaussian Blur For Canvas

Version: 	0.5
Author:		Mario Klingemann
Contact: 	mario@quasimondo.com
Website:	http://www.quasimondo.com/StackBlurForCanvas
Twitter:	@quasimondo

In case you find this class useful - especially in commercial projects -
I am not totally unhappy for a small donation to my PayPal account
mario@quasimondo.de

Or support me on flattr: 
https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript

Copyright (c) 2010 Mario Klingemann

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
var mul_table=[512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,289,287,285,282,280,278,275,273,271,269,267,265,263,261,259],shg_table=[9,11,12,13,13,14,14,15,15,15,15,16,16,16,16,17,17,17,17,17,17,17,18,18,18,18,18,18,18,18,18,19,19,19,19,19,19,19,19,19,19,19,19,19,19,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24];function stackBlurImage(a,t,e,r){var a=document.getElementById(a),n=a.naturalWidth,l=a.naturalHeight,g=document.getElementById(t),g=(g.style.width=n+"px",g.style.height=l+"px",g.width=n,g.height=l,g.getContext("2d"));g.clearRect(0,0,n,l),g.drawImage(a,0,0),isNaN(e)||e<1||(r?stackBlurCanvasRGBA:stackBlurCanvasRGB)(t,0,0,n,l,e)}function stackBlurCanvasRGBA(t,U,H,e,r,a){if(!(isNaN(a)||a<1)){a|=0;var n,t=document.getElementById(t).getContext("2d");try{try{n=t.getImageData(U,H,e,r)}catch(a){try{netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead"),n=t.getImageData(U,H,e,r)}catch(a){throw alert("Cannot access local image"),new Error("unable to access local image data: "+a)}}}catch(a){throw alert("Cannot access image"),new Error("unable to access image data: "+a)}for(var l,g,W,c,o,s,i,u,b,m,h,x,f,d,v,B,w,y,I,C,k,E=n.data,j=a+a+1,q=e-1,z=r-1,R=a+1,p=R*(R+1)/2,D=new BlurStack,N=D,_=1;_<j;_++){var F,N=N.next=new BlurStack;_==R&&(F=N)}N.next=D;for(var S=null,G=null,J=c=0,P=mul_table[a],A=shg_table[a],M=0;M<r;M++){for(f=d=v=B=o=s=i=u=0,b=R*(w=E[c]),m=R*(y=E[c+1]),h=R*(I=E[c+2]),x=R*(C=E[c+3]),o+=p*w,s+=p*y,i+=p*I,u+=p*C,N=D,_=0;_<R;_++)N.r=w,N.g=y,N.b=I,N.a=C,N=N.next;for(_=1;_<R;_++)o+=(N.r=w=E[g=c+((q<_?q:_)<<2)])*(k=R-_),s+=(N.g=y=E[g+1])*k,i+=(N.b=I=E[g+2])*k,u+=(N.a=C=E[g+3])*k,f+=w,d+=y,v+=I,B+=C,N=N.next;for(S=D,G=F,l=0;l<e;l++)E[c+3]=C=u*P>>A,0!=C?(E[c]=(o*P>>A)*(C=255/C),E[c+1]=(s*P>>A)*C,E[c+2]=(i*P>>A)*C):E[c]=E[c+1]=E[c+2]=0,o-=b,s-=m,i-=h,u-=x,b-=S.r,m-=S.g,h-=S.b,x-=S.a,g=J+((g=l+a+1)<q?g:q)<<2,o+=f+=S.r=E[g],s+=d+=S.g=E[g+1],i+=v+=S.b=E[g+2],u+=B+=S.a=E[g+3],S=S.next,b+=w=G.r,m+=y=G.g,h+=I=G.b,x+=C=G.a,f-=w,d-=y,v-=I,B-=C,G=G.next,c+=4;J+=e}for(l=0;l<e;l++){for(d=v=B=f=s=i=u=o=0,b=R*(w=E[c=l<<2]),m=R*(y=E[c+1]),h=R*(I=E[c+2]),x=R*(C=E[c+3]),o+=p*w,s+=p*y,i+=p*I,u+=p*C,N=D,_=0;_<R;_++)N.r=w,N.g=y,N.b=I,N.a=C,N=N.next;for(W=e,_=1;_<=a;_++)o+=(N.r=w=E[c=W+l<<2])*(k=R-_),s+=(N.g=y=E[c+1])*k,i+=(N.b=I=E[c+2])*k,u+=(N.a=C=E[c+3])*k,f+=w,d+=y,v+=I,B+=C,N=N.next,_<z&&(W+=e);for(c=l,S=D,G=F,M=0;M<r;M++)E[(g=c<<2)+3]=C=u*P>>A,0<C?(E[g]=(o*P>>A)*(C=255/C),E[g+1]=(s*P>>A)*C,E[g+2]=(i*P>>A)*C):E[g]=E[g+1]=E[g+2]=0,o-=b,s-=m,i-=h,u-=x,b-=S.r,m-=S.g,h-=S.b,x-=S.a,g=l+((g=M+R)<z?g:z)*e<<2,o+=f+=S.r=E[g],s+=d+=S.g=E[g+1],i+=v+=S.b=E[g+2],u+=B+=S.a=E[g+3],S=S.next,b+=w=G.r,m+=y=G.g,h+=I=G.b,x+=C=G.a,f-=w,d-=y,v-=I,B-=C,G=G.next,c+=e}t.putImageData(n,U,H)}}function stackBlurCanvasRGB(t,e,r,n,l,a){if(!(isNaN(a)||a<1)){a|=0;var g,t=document.getElementById(t).getContext("2d");try{try{g=t.getImageData(e,r,n,l)}catch(a){try{netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead"),g=t.getImageData(e,r,n,l)}catch(a){throw alert("Cannot access local image"),new Error("unable to access local image data: "+a)}}}catch(a){throw alert("Cannot access image"),new Error("unable to access image data: "+a)}for(var c,o,s,i,u,b,m,h,x,f,d,v,B,w,y,I,C,k=g.data,U=a+a+1,E=n-1,H=l-1,R=a+1,p=R*(R+1)/2,D=new BlurStack,N=D,_=1;_<U;_++){var W,N=N.next=new BlurStack;_==R&&(W=N)}N.next=D;for(var S=null,G=null,j=i=0,P=mul_table[a],A=shg_table[a],M=0;M<l;M++){for(d=v=B=u=b=m=0,h=R*(w=k[i]),x=R*(y=k[i+1]),f=R*(I=k[i+2]),u+=p*w,b+=p*y,m+=p*I,N=D,_=0;_<R;_++)N.r=w,N.g=y,N.b=I,N=N.next;for(_=1;_<R;_++)u+=(N.r=w=k[o=i+((E<_?E:_)<<2)])*(C=R-_),b+=(N.g=y=k[o+1])*C,m+=(N.b=I=k[o+2])*C,d+=w,v+=y,B+=I,N=N.next;for(S=D,G=W,c=0;c<n;c++)k[i]=u*P>>A,k[i+1]=b*P>>A,k[i+2]=m*P>>A,u-=h,b-=x,m-=f,h-=S.r,x-=S.g,f-=S.b,o=j+((o=c+a+1)<E?o:E)<<2,u+=d+=S.r=k[o],b+=v+=S.g=k[o+1],m+=B+=S.b=k[o+2],S=S.next,h+=w=G.r,x+=y=G.g,f+=I=G.b,d-=w,v-=y,B-=I,G=G.next,i+=4;j+=n}for(c=0;c<n;c++){for(v=B=d=b=m=u=0,h=R*(w=k[i=c<<2]),x=R*(y=k[i+1]),f=R*(I=k[i+2]),u+=p*w,b+=p*y,m+=p*I,N=D,_=0;_<R;_++)N.r=w,N.g=y,N.b=I,N=N.next;for(s=n,_=1;_<=a;_++)u+=(N.r=w=k[i=s+c<<2])*(C=R-_),b+=(N.g=y=k[i+1])*C,m+=(N.b=I=k[i+2])*C,d+=w,v+=y,B+=I,N=N.next,_<H&&(s+=n);for(i=c,S=D,G=W,M=0;M<l;M++)k[o=i<<2]=u*P>>A,k[o+1]=b*P>>A,k[o+2]=m*P>>A,u-=h,b-=x,m-=f,h-=S.r,x-=S.g,f-=S.b,o=c+((o=M+R)<H?o:H)*n<<2,u+=d+=S.r=k[o],b+=v+=S.g=k[o+1],m+=B+=S.b=k[o+2],S=S.next,h+=w=G.r,x+=y=G.g,f+=I=G.b,d-=w,v-=y,B-=I,G=G.next,i+=n}t.putImageData(g,e,r)}}function BlurStack(){this.r=0,this.g=0,this.b=0,this.a=0,this.next=null}